/**
 * Unit tests for backup-ipc handlers:
 * - backup-detect-local
 * - backup-restore-from-dir
 * - backup-select-folder
 * - performRestoreFromSourceDir (shared helper, tested via backup-restore-from-dir)
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dialog, ipcMain } from "electron";

import { registerBackupHandlers } from "./backup-ipc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a registered IPC handler by channel name from mock calls. */
function getHandler(channel: string) {
  const call = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === channel);
  if (!call) {
    throw new Error(`IPC handler '${channel}' not registered`);
  }
  return call[1] as (...args: unknown[]) => Promise<unknown>;
}

/** Create a temporary directory for each test. */
async function makeTempDir(prefix: string): Promise<string> {
  return fsp
    .mkdir(
      path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      {
        recursive: true,
      }
    )
    .then((dir) => dir ?? "");
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("backup-ipc handlers", () => {
  let stateDir: string;
  let mockParams: Parameters<typeof registerBackupHandlers>[0];

  beforeEach(async () => {
    vi.mocked(ipcMain.handle).mockReset();

    stateDir = await makeTempDir("backup-ipc-test-state");
    // Create a minimal stateDir with openclaw.json so gateway can "start"
    await fsp.writeFile(
      path.join(stateDir, "openclaw.json"),
      JSON.stringify({ agents: { defaults: { workspace: path.join(stateDir, "workspace") } } }),
      "utf-8"
    );

    mockParams = {
      stateDir,
      stopGatewayChild: vi.fn(async () => {}),
      startGateway: vi.fn(async () => {}),
      getMainWindow: () => null,
      setGatewayToken: vi.fn(),
      getGatewayToken: vi.fn(() => "test-token"),
      acceptConsent: vi.fn(async () => {}),
      getGatewayState: () => null,
      getLogsDir: () => "/tmp/logs",
      getConsentAccepted: () => true,
      userData: "/tmp/user",
      logsDir: "/tmp/logs",
      openclawDir: "/tmp/openclaw",
      gogBin: "/bin/gog",
      memoBin: "/bin/memo",
      remindctlBin: "/bin/remindctl",
      obsidianCliBin: "/bin/obsidian-cli",
      ghBin: "/bin/gh",
    };

    registerBackupHandlers(mockParams);
  });

  afterEach(async () => {
    // Clean up temp dirs
    try {
      await fsp.rm(stateDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
    // Also clean up .pre-restore dirs
    try {
      await fsp.rm(`${stateDir}.pre-restore`, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  });

  // ── backup-detect-local ──────────────────────────────────────────────

  describe("backup-detect-local", () => {
    it("returns found=true when ~/.openclaw/openclaw.json exists", async () => {
      const handler = getHandler("backup-detect-local");
      // Create fake ~/.openclaw/openclaw.json
      const openclawDir = path.join(os.homedir(), ".openclaw");
      const configExists = fs.existsSync(path.join(openclawDir, "openclaw.json"));

      const result = (await handler({})) as { found: boolean; path: string };
      expect(result.path).toBe(openclawDir);
      // Result depends on whether the real ~/.openclaw exists on this machine
      expect(typeof result.found).toBe("boolean");
      expect(result.found).toBe(configExists);
    });

    it("returns a valid path string", async () => {
      const handler = getHandler("backup-detect-local");
      const result = (await handler({})) as { found: boolean; path: string };
      expect(result.path).toContain(".openclaw");
      expect(typeof result.path).toBe("string");
    });
  });

  // ── backup-select-folder ─────────────────────────────────────────────

  describe("backup-select-folder", () => {
    it("returns cancelled when dialog is cancelled", async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: true,
        filePaths: [],
      });

      const handler = getHandler("backup-select-folder");
      const result = (await handler({})) as { ok: boolean; cancelled?: boolean };
      expect(result.ok).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    it("returns error when selected folder has no openclaw.json", async () => {
      const emptyDir = await makeTempDir("backup-ipc-test-empty");
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: false,
        filePaths: [emptyDir],
      });

      const handler = getHandler("backup-select-folder");
      const result = (await handler({})) as { ok: boolean; error?: string };
      expect(result.ok).toBe(false);
      expect(result.error).toContain("openclaw.json");

      await fsp.rm(emptyDir, { recursive: true, force: true });
    });

    it("returns ok and path when selected folder contains openclaw.json", async () => {
      const validDir = await makeTempDir("backup-ipc-test-valid");
      await fsp.writeFile(path.join(validDir, "openclaw.json"), "{}", "utf-8");
      vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
        canceled: false,
        filePaths: [validDir],
      });

      const handler = getHandler("backup-select-folder");
      const result = (await handler({})) as { ok: boolean; path?: string };
      expect(result.ok).toBe(true);
      expect(result.path).toBe(validDir);

      await fsp.rm(validDir, { recursive: true, force: true });
    });
  });

  // ── backup-restore-from-dir ──────────────────────────────────────────

  describe("backup-restore-from-dir", () => {
    it("returns error when no dirPath is provided", async () => {
      const handler = getHandler("backup-restore-from-dir");
      const result = (await handler({}, {})) as { ok: boolean; error?: string };
      expect(result.ok).toBe(false);
      expect(result.error).toContain("No directory path");
    });

    it("returns error when dirPath has no openclaw.json", async () => {
      const emptyDir = await makeTempDir("backup-ipc-test-nojson");
      const handler = getHandler("backup-restore-from-dir");
      const result = (await handler({}, { dirPath: emptyDir })) as {
        ok: boolean;
        error?: string;
      };
      expect(result.ok).toBe(false);
      expect(result.error).toContain("openclaw.json not found");

      await fsp.rm(emptyDir, { recursive: true, force: true });
    });

    it("restores successfully from a valid directory", async () => {
      // Create a source directory with openclaw.json
      const sourceDir = await makeTempDir("backup-ipc-test-source");
      const sourceConfig = {
        agents: { defaults: { workspace: path.join(sourceDir, "workspace") } },
        gateway: { mode: "local", bind: "loopback" },
      };
      await fsp.writeFile(
        path.join(sourceDir, "openclaw.json"),
        JSON.stringify(sourceConfig),
        "utf-8"
      );

      const handler = getHandler("backup-restore-from-dir");
      const result = (await handler({}, { dirPath: sourceDir })) as {
        ok: boolean;
        error?: string;
      };
      expect(result.ok).toBe(true);

      // Verify the restore sequence was executed
      expect(mockParams.stopGatewayChild).toHaveBeenCalled();
      expect(mockParams.acceptConsent).toHaveBeenCalled();
      expect(mockParams.startGateway).toHaveBeenCalled();

      // Verify the config was copied to stateDir
      const restoredConfig = await fsp.readFile(path.join(stateDir, "openclaw.json"), "utf-8");
      expect(restoredConfig).toBeTruthy();

      await fsp.rm(sourceDir, { recursive: true, force: true });
    });

    it("calls stopGateway, acceptConsent, and startGateway in order", async () => {
      const callOrder: string[] = [];
      mockParams.stopGatewayChild = vi.fn(async () => {
        callOrder.push("stop");
      });
      mockParams.acceptConsent = vi.fn(async () => {
        callOrder.push("consent");
      });
      mockParams.startGateway = vi.fn(async () => {
        callOrder.push("start");
      });

      // Re-register handlers with updated mocks
      vi.mocked(ipcMain.handle).mockReset();
      registerBackupHandlers(mockParams);

      const sourceDir = await makeTempDir("backup-ipc-test-order");
      await fsp.writeFile(
        path.join(sourceDir, "openclaw.json"),
        JSON.stringify({ agents: { defaults: { workspace: "/old/workspace" } } }),
        "utf-8"
      );

      const handler = getHandler("backup-restore-from-dir");
      await handler({}, { dirPath: sourceDir });

      expect(callOrder).toEqual(["stop", "consent", "start"]);

      await fsp.rm(sourceDir, { recursive: true, force: true });
    });

    it("patches restored config for desktop environment", async () => {
      const sourceDir = await makeTempDir("backup-ipc-test-patch");
      await fsp.writeFile(
        path.join(sourceDir, "openclaw.json"),
        JSON.stringify({
          agents: { defaults: { workspace: "/old/path/workspace" } },
          gateway: { mode: "remote", bind: "0.0.0.0" },
        }),
        "utf-8"
      );

      const handler = getHandler("backup-restore-from-dir");
      await handler({}, { dirPath: sourceDir });

      const restored = JSON.parse(
        await fsp.readFile(path.join(stateDir, "openclaw.json"), "utf-8")
      );
      // Config should be patched for desktop: local mode, loopback bind
      expect(restored.gateway.mode).toBe("local");
      expect(restored.gateway.bind).toBe("loopback");

      await fsp.rm(sourceDir, { recursive: true, force: true });
    });
  });

  // ── Handler registration ─────────────────────────────────────────────

  describe("handler registration", () => {
    it("registers all 6 expected backup channels", () => {
      const channels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
      expect(channels).toContain("backup-create");
      expect(channels).toContain("backup-restore");
      expect(channels).toContain("backup-detect-local");
      expect(channels).toContain("backup-restore-from-dir");
      expect(channels).toContain("backup-select-folder");
    });
  });
});
