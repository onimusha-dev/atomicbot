import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import type { ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { registerIpcHandlers } from "./main/ipc/register";
import { registerTerminalIpcHandlers } from "./main/terminal/ipc";
import { DEFAULT_PORT } from "./main/constants";
import { ensureGatewayConfigFile, readGatewayTokenFromConfig } from "./main/gateway/config";
import { spawnGateway } from "./main/gateway/spawn";
import {
  writeGatewayPid,
  removeGatewayPid,
  killOrphanedGateway,
  removeStaleGatewayLock,
} from "./main/gateway/pid-file";
import { initAutoUpdater, disposeAutoUpdater } from "./main/updater";
import { killUpdateSplash } from "./main/update-splash";
import {
  resolveBin,
  resolveBundledNodeBin,
  resolveBundledOpenClawDir,
  resolvePreloadPath,
  resolveRendererIndex,
  resolveRepoRoot,
} from "./main/openclaw/paths";
import { createTailBuffer, pickPort, waitForPortOpen } from "./main/util/net";
import { createMainWindow } from "./main/window/mainWindow";
import type { GatewayState } from "./main/types";

const MAIN_DIR = __dirname;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

let preloadPathForWindow: string | null = null;
let rendererIndexForWindow: string | null = null;

let gateway: ChildProcess | null = null;
let gatewayPid: number | null = null;
let gatewayStateDir: string | null = null;
let logsDirForUi: string | null = null;
let gatewayState: GatewayState | null = null;
let consentAccepted = false;

async function stopGatewayChild(): Promise<void> {
  const pid = gatewayPid;
  gateway = null;
  if (!pid) {
    return;
  }

  // Graceful shutdown: SIGTERM lets the gateway drain active tasks and close cleanly.
  const killGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-pid, signal);
    } catch {
      process.kill(pid, signal);
    }
  };

  try {
    killGroup("SIGTERM");
  } catch {
    // Already dead
    gatewayPid = null;
    return;
  }

  // Wait up to 5s for graceful exit, then escalate to SIGKILL.
  const gracefulDeadline = Date.now() + 5000;
  while (Date.now() < gracefulDeadline) {
    try {
      process.kill(pid, 0);
    } catch {
      gatewayPid = null;
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  // Still alive — force kill the process group.
  try {
    killGroup("SIGKILL");
  } catch {
    // Already dead
  }

  // Brief wait for SIGKILL to take effect.
  const killDeadline = Date.now() + 2000;
  while (Date.now() < killDeadline) {
    try {
      process.kill(pid, 0);
    } catch {
      break;
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  gatewayPid = null;
}

function broadcastGatewayState(win: BrowserWindow | null, state: GatewayState) {
  gatewayState = state;
  try {
    win?.webContents.send("gateway-state", state);
  } catch (err) {
    console.warn("[main] broadcastGatewayState failed:", err);
  }
}

function getTrayIconPath(): string {
  // In packaged apps, `__dirname` points inside `app.asar`. Prefer a real on-disk path under
  // `process.resourcesPath` for the menubar/tray icon (we stage it via `extraResources`).
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", "trayTemplate.png");
  }

  // Dev: `__dirname` is `dist/`, and `assets/` is next to it.
  return path.join(MAIN_DIR, "..", "assets", "trayTemplate.png");
}

async function ensureMainWindow(): Promise<BrowserWindow | null> {
  const win = mainWindow;
  if (win && !win.isDestroyed()) {
    return win;
  }

  if (!preloadPathForWindow || !rendererIndexForWindow) {
    return null;
  }

  const nextWin = await createMainWindow({
    preloadPath: preloadPathForWindow,
    rendererIndex: rendererIndexForWindow,
  });
  mainWindow = nextWin;

  nextWin.on("closed", () => {
    if (mainWindow === nextWin) {
      mainWindow = null;
    }
  });

  if (gatewayState) {
    broadcastGatewayState(nextWin, gatewayState);
  }

  return nextWin;
}

async function showMainWindow(): Promise<void> {
  const win = await ensureMainWindow();
  if (!win) {
    return;
  }
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
}

function ensureTray(): void {
  if (tray) {
    return;
  }

  const trayImage = nativeImage.createFromPath(getTrayIconPath());
  // Avoid `nativeImage.resize()` here. Some Electron/macOS combos can crash inside the PNG stack
  // during startup. The Tray API and OS will scale as needed, and we ship correctly-sized assets.
  if (process.platform === "darwin") {
    trayImage.setTemplateImage(true);
  }

  tray = new Tray(trayImage);
  tray.setToolTip("Atomic Bot");

  const menu = Menu.buildFromTemplate([
    {
      label: "Show Atomic Bot",
      click: () => {
        void showMainWindow();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  // Show the dropdown on left click (macOS menubar UX).
  tray.on("click", () => {
    tray?.popUpContextMenu(menu);
  });
  tray.on("right-click", () => {
    tray?.popUpContextMenu(menu);
  });

  // Keep the menu available for platforms that use right-click by default.
  tray.setContextMenu(menu);
}

app.on("window-all-closed", () => {
  // macOS convention: keep the app alive until the user quits explicitly.
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  void showMainWindow();
});

// Last-resort synchronous kill: if the process exits without proper cleanup,
// force-kill the gateway process group so nothing lingers as an orphan.
process.on("exit", () => {
  if (gatewayPid) {
    try {
      process.kill(-gatewayPid, "SIGKILL");
    } catch {
      try {
        process.kill(gatewayPid, "SIGKILL");
      } catch {
        // Already dead — nothing to do.
      }
    }
    gatewayPid = null;
  }
});

let isQuitting = false;
app.on("before-quit", (event) => {
  if (isQuitting) {
    return;
  }
  // Prevent the default quit so we can await async cleanup first.
  isQuitting = true;
  event.preventDefault();

  disposeAutoUpdater();
  stopGatewayChild()
    .then(() => {
      if (gatewayStateDir) {
        removeGatewayPid(gatewayStateDir);
      }
    })
    .finally(() => {
      // Now let the app actually quit (isQuitting flag prevents re-entry).
      app.quit();
    });
});

void app.whenReady().then(async () => {
  const userData = app.getPath("userData");
  const stateDir = path.join(userData, "openclaw");
  gatewayStateDir = stateDir;
  const logsDir = path.join(userData, "logs");
  logsDirForUi = logsDir;

  // Kill any orphaned gateway process left over from a previous crash / force-quit.
  const killedPid = killOrphanedGateway(stateDir);
  if (killedPid) {
    console.log(`[main] Cleaned up orphaned gateway process (PID ${killedPid})`);
  }

  // Temporary: force-kill all lingering openclaw-gateway processes to prevent
  // zombie instances. Safe because we are about to spawn a fresh one.
  // TODO: remove after 1-2 releases once the orphan cleanup above is proven reliable.
  try {
    const { execSync } = await import("node:child_process");
    execSync("pkill -9 openclaw-gateway", { stdio: "ignore" });
    console.log("[main] pkill openclaw-gateway: killed lingering processes");
  } catch {
    // pkill exits non-zero when no matching processes found — expected.
  }

  // Remove stale gateway lock file so the new spawn can acquire it.
  const configPath = path.join(stateDir, "openclaw.json");
  removeStaleGatewayLock(configPath);

  const openclawDir = app.isPackaged ? resolveBundledOpenClawDir() : resolveRepoRoot(MAIN_DIR);
  // In dev, prefer a real Node binary. Spawning the Gateway via the Electron binary (process.execPath)
  // can create an extra bouncing Dock icon on macOS.
  const nodeBin = app.isPackaged
    ? resolveBundledNodeBin()
    : (process.env.OPENCLAW_DESKTOP_NODE_BIN || "node").trim() || "node";
  const binOpts = { isPackaged: app.isPackaged, mainDir: MAIN_DIR };
  const gogBin = resolveBin("gog", binOpts);
  const jqBin = resolveBin("jq", binOpts);
  const memoBin = resolveBin("memo", binOpts);
  const remindctlBin = resolveBin("remindctl", binOpts);
  const obsidianCliBin = resolveBin("obsidian-cli", binOpts);
  const ghBin = resolveBin("gh", binOpts);

  const port = await pickPort(DEFAULT_PORT);
  const url = `http://127.0.0.1:${port}/`;
  const tokenFromConfig = readGatewayTokenFromConfig(configPath);
  let token = tokenFromConfig ?? randomBytes(24).toString("base64url");
  ensureGatewayConfigFile({ configPath, token });

  const rendererIndex = resolveRendererIndex({
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    mainDir: MAIN_DIR,
  });
  const preloadPath = resolvePreloadPath(MAIN_DIR);
  preloadPathForWindow = preloadPath;
  rendererIndexForWindow = rendererIndex;

  await ensureMainWindow();
  ensureTray();

  // Kill any lingering update splash from the previous version's restart.
  killUpdateSplash();

  // Initialize auto-updater in packaged builds only.
  if (app.isPackaged) {
    initAutoUpdater(() => mainWindow);
  }

  // Consent is stored in the same per-user state dir as the embedded gateway config.
  const consentPath = path.join(stateDir, "consent.json");
  consentAccepted = readConsentAccepted(consentPath);

  const stderrTail = createTailBuffer(24_000);

  const startGateway = async () => {
    if (gateway) {
      return;
    }
    const nextWin = await ensureMainWindow();
    broadcastGatewayState(nextWin, { kind: "starting", port, logsDir, token });
    gateway = spawnGateway({
      port,
      logsDir,
      stateDir,
      configPath,
      token,
      openclawDir,
      nodeBin,
      gogBin,
      jqBin,
      memoBin,
      remindctlBin,
      obsidianCliBin,
      ghBin,
      electronRunAsNode: nodeBin === process.execPath,
      stderrTail,
    });

    // Track the PID for orphan cleanup (process.on('exit') guard + PID file for next launch).
    const thisPid = gateway.pid ?? null;
    gatewayPid = thisPid;
    if (thisPid) {
      writeGatewayPid(stateDir, thisPid);
    }
    gateway.on("exit", () => {
      // Only clear if this is still the active gateway — avoids a race where
      // the old process's exit event fires after a new gateway has been spawned,
      // which would null out the new PID and leave it un-killable on quit.
      if (gatewayPid === thisPid) {
        gatewayPid = null;
        removeGatewayPid(stateDir);
      }
    });

    const ok = await waitForPortOpen("127.0.0.1", port, 30_000);
    if (!ok) {
      const details = [
        `Gateway did not open the port within 30s.`,
        "",
        `openclawDir: ${openclawDir}`,
        `nodeBin: ${nodeBin}`,
        `stderr (tail):`,
        stderrTail.read().trim() || "<empty>",
        "",
        `See logs in: ${logsDir}`,
      ].join("\n");
      broadcastGatewayState(nextWin, { kind: "failed", port, logsDir, details, token });
      return;
    }

    // Keep the Electron window on the React renderer. The legacy Control UI is embedded in an iframe
    // and can be switched to/from the native pages without losing the top-level navigation.
    broadcastGatewayState(nextWin, { kind: "ready", port, logsDir, url, token });
  };

  registerIpcHandlers({
    getMainWindow: () => mainWindow,
    getGatewayState: () => gatewayState,
    getLogsDir: () => logsDirForUi,
    getConsentAccepted: () => consentAccepted,
    acceptConsent: async () => {
      consentAccepted = true;
      writeConsentAccepted(consentPath);
    },
    startGateway,
    userData,
    stateDir,
    logsDir,
    openclawDir,
    gogBin,
    memoBin,
    remindctlBin,
    obsidianCliBin,
    ghBin,
    stopGatewayChild,
    getGatewayToken: () => token,
    setGatewayToken: (t: string) => {
      token = t;
    },
  });

  registerTerminalIpcHandlers({
    getMainWindow: () => mainWindow,
    stateDir,
    openclawDir,
    nodeBin,
    gogBin,
    jqBin,
    memoBin,
    remindctlBin,
    obsidianCliBin,
    ghBin,
  });

  // Always start the gateway on launch — consent is handled in the renderer
  // after the gateway is ready (loading screen shows while gateway starts).
  await startGateway();
});

function readConsentAccepted(consentPath: string): boolean {
  try {
    if (!fs.existsSync(consentPath)) {
      return false;
    }
    const raw = fs.readFileSync(consentPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return false;
    }
    const obj = parsed as { accepted?: unknown };
    return obj.accepted === true;
  } catch (err) {
    console.warn("[main] readConsentAccepted failed:", err);
    return false;
  }
}

function writeConsentAccepted(consentPath: string): void {
  try {
    fs.mkdirSync(path.dirname(consentPath), { recursive: true });
    const payload = { accepted: true, acceptedAt: new Date().toISOString() };
    fs.writeFileSync(consentPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  } catch (err) {
    console.warn("[main] writeConsentAccepted failed:", err);
  }
}
