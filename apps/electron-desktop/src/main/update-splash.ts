/**
 * Update splash helper for macOS.
 *
 * Spawns a lightweight, detached osascript (JXA) process that displays a native
 * floating window while the app restarts during an update.  The splash survives
 * the old Electron process quitting and auto-closes once it detects the new
 * instance of the app (or after a 120-second timeout).
 *
 * The new app instance should call `killUpdateSplash()` on startup to ensure
 * the splash is removed promptly.
 */

import { app } from "electron";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SENTINEL_FILENAME = "update-splash.pid";
const TEMP_SCRIPT_NAME = "atomicbot-update-splash.js";

// ---------------------------------------------------------------------------
// JXA script (JavaScript for Automation) that renders a native macOS window.
// Runs via `osascript -l JavaScript <file> <oldPid> <sentinelPath> <bundleId>`.
// ---------------------------------------------------------------------------
const JXA_SCRIPT = /* js */ `
function run(argv) {
  var oldPid = parseInt(argv[0], 10) || 0;
  var sentinelPath = argv[1] || '';
  var bundleId = argv[2] || 'ai.atomicbot.desktop';

  ObjC.import('Cocoa');

  var nsApp = $.NSApplication.sharedApplication;
  // Accessory activation policy = no Dock icon, no menu bar.
  nsApp.setActivationPolicy(2);

  // Write our PID to the sentinel file so the new app instance can kill us.
  if (sentinelPath) {
    var pid = $.NSProcessInfo.processInfo.processIdentifier;
    var pidStr = $.NSString.stringWithFormat('%d', pid);
    // NSUTF8StringEncoding = 4
    pidStr.writeToFileAtomicallyEncodingError(sentinelPath, true, 4, null);
  }

  // ---- Window ----
  // Titled + FullSizeContentView gives native rounded corners; traffic light
  // buttons are hidden so they don't shift the layout.
  var W = 360, H = 180;
  var styleMask = 1 | (1 << 15); // NSWindowStyleMaskTitled | FullSizeContentView
  var win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(
    $.NSMakeRect(0, 0, W, H), styleMask, 2 /* NSBackingStoreBuffered */, false
  );

  win.titlebarAppearsTransparent = true;
  win.titleVisibility = 1; // NSWindowTitleHidden
  // Hide close / minimize / zoom buttons (JXA: use property, not setter).
  win.standardWindowButton(0).hidden = true;
  win.standardWindowButton(1).hidden = true;
  win.standardWindowButton(2).hidden = true;
  win.isMovableByWindowBackground = true;
  win.level = 3; // NSFloatingWindowLevel
  win.hasShadow = true;
  win.backgroundColor = $.NSColor.colorWithSRGBRedGreenBlueAlpha(
    0.043, 0.059, 0.078, 1.0 // #0b0f14
  );

  // Force dark appearance so the native spinner is light-on-dark.
  try {
    win.appearance = $.NSAppearance.appearanceNamed('NSAppearanceNameDarkAqua');
  } catch (e) { /* pre-Mojave fallback: ignore */ }

  // Visible on all Spaces / Mission Control desktops.
  win.collectionBehavior = 1 << 0; // NSWindowCollectionBehaviorCanJoinAllSpaces

  var cv = win.contentView;

  // ---- Spinner (40x40, centered) ----
  var spinner = $.NSProgressIndicator.alloc.initWithFrame(
    $.NSMakeRect((W - 40) / 2, 70, 40, 40)
  );
  spinner.style = 1; // NSProgressIndicatorStyleSpinning
  spinner.displayedWhenStopped = false;
  spinner.startAnimation(null);
  cv.addSubview(spinner);

  // ---- Helper: measure text width and create a centered label ----
  function makeLabel(text, font, color, y, h) {
    var attrs = $.NSDictionary.dictionaryWithObjectForKey(font, $.NSFontAttributeName);
    var textW = $(text).sizeWithAttributes(attrs).width + 4;
    var textX = (W - textW) / 2;
    var field = $.NSTextField.alloc.initWithFrame($.NSMakeRect(textX, y, textW, h));
    field.stringValue = text;
    field.setBezeled(false);
    field.setDrawsBackground(false);
    field.setEditable(false);
    field.setSelectable(false);
    field.textColor = color;
    field.font = font;
    return field;
  }

  // ---- Title label (manually centered) ----
  cv.addSubview(makeLabel(
    'Updating Atomic Bot\\u2026',
    $.NSFont.systemFontOfSizeWeight(16, 0.5),
    $.NSColor.colorWithSRGBRedGreenBlueAlpha(0.9, 0.93, 0.95, 1.0),
    26, 28
  ));

  // ---- Subtitle (manually centered) ----
  cv.addSubview(makeLabel(
    'Please wait\\u2026',
    $.NSFont.systemFontOfSize(12),
    $.NSColor.colorWithSRGBRedGreenBlueAlpha(0.55, 0.6, 0.65, 1.0),
    4, 20
  ));

  // ---- Show ----
  // Manual centering via setFrameDisplayAnimate (performSelector('center')
  // and win.center() both crash in JXA).
  var screen = $.NSScreen.mainScreen.frame;
  var cx = (screen.size.width - W) / 2;
  var cy = (screen.size.height - H) / 2;
  win.setFrameDisplayAnimate($.NSMakeRect(cx, cy, W, H), true, false);
  win.makeKeyAndOrderFront(null);
  nsApp.activateIgnoringOtherApps(true);

  // ---- Poll loop: wait for the new app or timeout ----
  var MAX_SECONDS = 120;
  var POLL_INTERVAL = 1.0; // seconds
  var elapsed = 0;
  var oldPidDead = (oldPid === 0);

  while (elapsed < MAX_SECONDS) {
    // Run the Cocoa event loop for POLL_INTERVAL seconds (processes redraws).
    $.NSRunLoop.currentRunLoop.runUntilDate(
      $.NSDate.dateWithTimeIntervalSinceNow(POLL_INTERVAL)
    );
    elapsed += POLL_INTERVAL;

    // Check if the old Electron process has exited.
    if (!oldPidDead) {
      var stillRunning = false;
      var allApps = $.NSWorkspace.sharedWorkspace.runningApplications;
      for (var i = 0; i < allApps.count; i++) {
        if (allApps.objectAtIndex(i).processIdentifier === oldPid) {
          stillRunning = true;
          break;
        }
      }
      if (!stillRunning) {
        oldPidDead = true;
      }
    }

    // Once the old instance is gone, look for a new one.
    if (oldPidDead) {
      var allApps2 = $.NSWorkspace.sharedWorkspace.runningApplications;
      for (var j = 0; j < allApps2.count; j++) {
        var ra = allApps2.objectAtIndex(j);
        var bid = ra.bundleIdentifier;
        if (bid) {
          try {
            if (ObjC.unwrap(bid) === bundleId) {
              // New instance detected. Give it a moment to render its window.
              $.NSRunLoop.currentRunLoop.runUntilDate(
                $.NSDate.dateWithTimeIntervalSinceNow(2.5)
              );
              cleanup(sentinelPath);
              return;
            }
          } catch (e) { /* ignore */ }
        }
      }
    }
  }

  // Timeout reached.
  cleanup(sentinelPath);
}

function cleanup(sentinelPath) {
  if (sentinelPath) {
    try {
      $.NSFileManager.defaultManager.removeItemAtPathError(sentinelPath, null);
    } catch (e) { /* ignore */ }
  }
}
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Show the native update splash window.
 *
 * Should be called immediately before `autoUpdater.quitAndInstall()`. The
 * splash runs as a detached osascript process that survives the Electron quit.
 */
export function showUpdateSplash(): void {
  if (process.platform !== "darwin") {
    return;
  }

  try {
    const stateDir = path.join(app.getPath("userData"), "openclaw");
    fs.mkdirSync(stateDir, { recursive: true });

    const sentinelPath = path.join(stateDir, SENTINEL_FILENAME);
    const scriptPath = path.join(os.tmpdir(), TEMP_SCRIPT_NAME);

    // Write the JXA script to a temp file so osascript can read it.
    fs.writeFileSync(scriptPath, JXA_SCRIPT, "utf-8");

    const bundleId = "ai.atomicbot.desktop";

    const child = spawn(
      "osascript",
      ["-l", "JavaScript", scriptPath, String(process.pid), sentinelPath, bundleId],
      { detached: true, stdio: "ignore" }
    );
    child.unref();
  } catch (err) {
    console.warn("[update-splash] showUpdateSplash failed:", err);
  }
}

/**
 * Kill a lingering update splash (if any).
 *
 * Call this early during app startup so the splash disappears as soon as the
 * new app instance is alive.
 */
export function killUpdateSplash(): void {
  if (process.platform !== "darwin") {
    return;
  }

  try {
    const stateDir = path.join(app.getPath("userData"), "openclaw");
    const sentinelPath = path.join(stateDir, SENTINEL_FILENAME);

    if (!fs.existsSync(sentinelPath)) {
      return;
    }

    const raw = fs.readFileSync(sentinelPath, "utf-8").trim();
    const pid = parseInt(raw, 10);

    if (pid > 0) {
      try {
        process.kill(pid, "SIGTERM");
      } catch (err) {
        console.warn("[update-splash] kill splash process failed:", err);
      }
    }

    fs.unlinkSync(sentinelPath);
  } catch (err) {
    console.warn("[update-splash] killUpdateSplash failed:", err);
  }
}
