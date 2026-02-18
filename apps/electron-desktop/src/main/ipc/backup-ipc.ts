/**
 * IPC handlers for full config backup (create) and restore.
 *
 * - backup-create: zips the stateDir and lets the user pick a save location.
 * - backup-restore: receives a base64-encoded archive (zip or tar.gz),
 *   validates it, swaps config, and restarts the gateway.
 */
import { app, dialog, ipcMain } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";

import JSON5 from "json5";
import JSZip from "jszip";
import type { RegisterParams } from "./types";
import { readGatewayTokenFromConfig } from "../gateway/config";

const execFileAsync = promisify(execFile);

/**
 * Recursively add every file/dir inside `dirPath` to a JSZip instance.
 * `baseDir` is stripped from the stored zip entry paths.
 */
async function addDirToZip(zip: JSZip, dirPath: string, baseDir: string): Promise<void> {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    if (entry.isDirectory()) {
      zip.folder(relativePath);
      await addDirToZip(zip, fullPath, baseDir);
    } else if (entry.isFile()) {
      const data = await fsp.readFile(fullPath);
      zip.file(relativePath, data);
    }
  }
}

/**
 * After extraction, resolve the backup root: if the zip contains a single top-level
 * directory with `openclaw.json` inside, use that; otherwise use extractDir itself.
 */
async function resolveBackupRoot(extractDir: string): Promise<string> {
  // Check extractDir directly first
  try {
    await fsp.stat(path.join(extractDir, "openclaw.json"));
    return extractDir;
  } catch {
    // not at top level
  }

  // Check if there's a single subdirectory containing the config
  const entries = await fsp.readdir(extractDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 1 && dirs[0]) {
    const candidate = path.join(extractDir, dirs[0].name);
    try {
      await fsp.stat(path.join(candidate, "openclaw.json"));
      return candidate;
    } catch {
      // not there either
    }
  }

  throw new Error("Invalid backup: openclaw.json not found in the archive");
}

/**
 * Extract a zip buffer into destDir using JSZip.
 * Validates that no entry escapes the destination directory.
 */
async function extractZipBuffer(buffer: Buffer, destDir: string): Promise<void> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    const entryPath = entry.name.replaceAll("\\", "/");
    if (!entryPath || entryPath.endsWith("/")) {
      const dirPath = path.resolve(destDir, entryPath);
      if (!dirPath.startsWith(destDir)) {
        throw new Error(`zip entry escapes destination: ${entry.name}`);
      }
      await fsp.mkdir(dirPath, { recursive: true });
      continue;
    }
    const outPath = path.resolve(destDir, entryPath);
    if (!outPath.startsWith(destDir)) {
      throw new Error(`zip entry escapes destination: ${entry.name}`);
    }
    await fsp.mkdir(path.dirname(outPath), { recursive: true });
    const data = await entry.async("nodebuffer");
    await fsp.writeFile(outPath, data);
  }
}

/**
 * Extract a tar.gz buffer into destDir using the system `tar` command.
 * Writes the buffer to a temp file, extracts, then cleans up.
 */
async function extractTarGzBuffer(buffer: Buffer, destDir: string): Promise<void> {
  const tmpTar = path.join(os.tmpdir(), `openclaw-tgz-${randomBytes(8).toString("hex")}.tar.gz`);
  await fsp.writeFile(tmpTar, buffer);
  try {
    await execFileAsync("tar", ["-xzf", tmpTar, "-C", destDir]);
  } finally {
    await fsp.rm(tmpTar, { force: true }).catch(() => {});
  }
}

type ArchiveFormat = "zip" | "tar.gz";

/** Detect archive format from magic bytes in the buffer header. */
function detectArchiveFormat(buffer: Buffer): ArchiveFormat | null {
  if (buffer.length < 4) return null;
  // ZIP: starts with PK (0x50 0x4B)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return "zip";
  // GZIP: starts with 0x1F 0x8B
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) return "tar.gz";
  return null;
}

/** Extract an archive buffer (zip or tar.gz) into destDir. */
async function extractArchiveBuffer(
  buffer: Buffer,
  destDir: string,
  filenameHint?: string
): Promise<void> {
  const format = detectArchiveFormat(buffer);
  if (format === "zip") {
    return extractZipBuffer(buffer, destDir);
  }
  if (format === "tar.gz") {
    return extractTarGzBuffer(buffer, destDir);
  }
  // Fallback: try to guess from filename if magic bytes are inconclusive
  if (filenameHint) {
    const lower = filenameHint.toLowerCase();
    if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
      return extractTarGzBuffer(buffer, destDir);
    }
    if (lower.endsWith(".zip")) {
      return extractZipBuffer(buffer, destDir);
    }
  }
  throw new Error("Unsupported archive format. Please use .zip or .tar.gz");
}

/**
 * Read the backup's openclaw.json and derive the old stateDir
 * from the workspace path (its parent directory).
 * Returns null when the old stateDir cannot be determined.
 */
function detectOldStateDir(configPath: string): string | null {
  try {
    if (!fs.existsSync(configPath)) return null;
    const text = fs.readFileSync(configPath, "utf-8");
    const cfg = JSON5.parse(text);
    if (!cfg || typeof cfg !== "object") return null;

    // Prefer agents.defaults.workspace
    const defaultWs = cfg.agents?.defaults?.workspace;
    if (typeof defaultWs === "string" && defaultWs.length > 0) {
      return path.posix.dirname(defaultWs.replaceAll("\\", "/"));
    }

    // Fallback: first agent entry with a workspace
    if (Array.isArray(cfg.agents?.list)) {
      for (const agent of cfg.agents.list) {
        if (agent && typeof agent.workspace === "string") {
          return path.posix.dirname(agent.workspace.replaceAll("\\", "/"));
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Recursively walk every file under `dir` and replace all occurrences of
 * `oldStr` with `newStr` in text files. Binary files (containing null bytes
 * in the first 8 KB) are skipped.
 */
async function rewritePathsInDir(dir: string, oldStr: string, newStr: string): Promise<number> {
  let count = 0;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += await rewritePathsInDir(fullPath, oldStr, newStr);
    } else if (entry.isFile()) {
      try {
        const buf = await fsp.readFile(fullPath);
        // Skip binary files
        const sample = buf.subarray(0, 8192);
        if (sample.includes(0)) continue;

        const text = buf.toString("utf-8");
        if (text.includes(oldStr)) {
          await fsp.writeFile(fullPath, text.replaceAll(oldStr, newStr), "utf-8");
          count++;
        }
      } catch {
        // skip unreadable/unwritable files
      }
    }
  }
  return count;
}

/**
 * After restoring a backup, patch the config so it works correctly
 * in the current Electron desktop environment:
 * - Rewrite workspace paths to the current stateDir
 * - Ensure gateway is in local/loopback mode
 * - Allow "null" origin (Electron renderer loads from file://)
 * - Disable device auth (desktop app uses token auth)
 */
function patchRestoredConfig(configPath: string, currentStateDir: string): void {
  try {
    if (!fs.existsSync(configPath)) return;

    const text = fs.readFileSync(configPath, "utf-8");
    const cfg = JSON5.parse(text);
    if (!cfg || typeof cfg !== "object") return;

    const defaultWorkspace = path.join(currentStateDir, "workspace");

    // ── Workspace paths ───────────────────────────────────────────────
    if (typeof cfg.agents?.defaults?.workspace === "string") {
      cfg.agents.defaults.workspace = defaultWorkspace;
    }

    if (Array.isArray(cfg.agents?.list)) {
      for (const agent of cfg.agents.list) {
        if (agent && typeof agent.workspace === "string") {
          const agentId = typeof agent.id === "string" ? agent.id.trim() : "";
          const isDefault = agent.default === true || agentId === "main";
          agent.workspace = isDefault
            ? defaultWorkspace
            : path.join(currentStateDir, `workspace-${agentId || "unknown"}`);
        }
      }
    }

    // ── Gateway settings for Electron desktop ─────────────────────────
    if (!cfg.gateway || typeof cfg.gateway !== "object") {
      cfg.gateway = {};
    }
    cfg.gateway.mode = "local";
    cfg.gateway.bind = "loopback";

    if (!cfg.gateway.controlUi || typeof cfg.gateway.controlUi !== "object") {
      cfg.gateway.controlUi = {};
    }
    const allowedOrigins: unknown[] = Array.isArray(cfg.gateway.controlUi.allowedOrigins)
      ? cfg.gateway.controlUi.allowedOrigins
      : [];
    if (!allowedOrigins.includes("null")) {
      allowedOrigins.push("null");
    }
    cfg.gateway.controlUi.allowedOrigins = allowedOrigins;
    cfg.gateway.controlUi.dangerouslyDisableDeviceAuth = true;

    fs.writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf-8");
    console.log("[ipc/backup] patched restored config for desktop environment");
  } catch (err) {
    console.warn("[ipc/backup] patchRestoredConfig failed:", err);
  }
}

export function registerBackupHandlers(params: RegisterParams) {
  const {
    stateDir,
    stopGatewayChild,
    startGateway,
    getMainWindow,
    setGatewayToken,
    acceptConsent,
  } = params;

  /**
   * Shared restore logic: given a source directory that contains openclaw.json,
   * stop gateway, swap stateDir contents, rewrite paths, patch config, restart.
   * Used by both archive-based and directory-based restore flows.
   */
  async function performRestoreFromSourceDir(sourceDir: string): Promise<void> {
    const preRestoreDir = `${stateDir}.pre-restore`;

    // 1. Stop the gateway
    await stopGatewayChild();

    // 2. Safety backup: rename current stateDir
    try {
      await fsp.rm(preRestoreDir, { recursive: true, force: true });
    } catch {
      // may not exist
    }
    if (fs.existsSync(stateDir)) {
      await fsp.rename(stateDir, preRestoreDir);
    }

    try {
      // 3. Create fresh stateDir and copy backup contents
      await fsp.mkdir(stateDir, { recursive: true });
      await fsp.cp(sourceDir, stateDir, { recursive: true });

      // 4. Detect old stateDir from backup config and rewrite stale
      //    paths across all restored text files (sessions, logs, etc.)
      const configPath = path.join(stateDir, "openclaw.json");
      const oldStateDir = detectOldStateDir(configPath);
      if (oldStateDir && oldStateDir !== stateDir) {
        const rewritten = await rewritePathsInDir(stateDir, oldStateDir, stateDir);
        console.log(
          `[ipc/backup] rewrote paths in ${rewritten} file(s): ${oldStateDir} → ${stateDir}`
        );
      }

      // 5. Patch config for the desktop environment (workspace paths,
      //    gateway mode, controlUi origin allowlist)
      patchRestoredConfig(configPath, stateDir);

      // 6. Read the token from the restored config and update in-memory state
      //    so gateway, main process, and renderer all use the backup's token.
      const restoredToken = readGatewayTokenFromConfig(configPath);
      if (restoredToken) {
        setGatewayToken(restoredToken);
      }

      // 7. Mark terms of service as accepted so the gateway starts without
      //    requiring the user to re-accept consent after a backup restore.
      await acceptConsent();

      // 8. Start the gateway — it reads the token from config + env var (now in sync)
      await startGateway();
    } catch (err) {
      // Attempt rollback: restore original stateDir and restart gateway
      try {
        if (fs.existsSync(stateDir)) {
          await fsp.rm(stateDir, { recursive: true, force: true });
        }
        if (fs.existsSync(preRestoreDir)) {
          await fsp.rename(preRestoreDir, stateDir);
        }
        await startGateway();
      } catch (rollbackErr) {
        console.error("[ipc/backup] rollback also failed:", rollbackErr);
      }
      throw err;
    }
  }

  // ── Create backup ──────────────────────────────────────────────────────
  ipcMain.handle("backup-create", async () => {
    try {
      // Build the zip from stateDir
      const zip = new JSZip();
      await addDirToZip(zip, stateDir, stateDir);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

      const now = new Date();
      const datePart = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");
      const timePart = [
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
      ].join("");

      const parentWindow = getMainWindow();
      const dialogOpts = {
        title: "Save OpenClaw Backup",
        defaultPath: path.join(
          app.getPath("documents"),
          `atomicbot-backup-${datePart}-${timePart}.zip`
        ),
        filters: [{ name: "ZIP Archives", extensions: ["zip"] }],
      };
      const result = parentWindow
        ? await dialog.showSaveDialog(parentWindow, dialogOpts)
        : await dialog.showSaveDialog(dialogOpts);

      if (result.canceled || !result.filePath) {
        return { ok: false, cancelled: true };
      }

      await fsp.writeFile(result.filePath, zipBuffer);
      return { ok: true };
    } catch (err) {
      console.error("[ipc/backup] backup-create failed:", err);
      return { ok: false, error: `Failed to create backup: ${String(err)}` };
    }
  });

  // ── Restore from backup archive ───────────────────────────────────────
  ipcMain.handle("backup-restore", async (_evt, p: { data?: unknown; filename?: unknown }) => {
    const b64 = typeof p?.data === "string" ? p.data : "";
    if (!b64) {
      return { ok: false, error: "No data provided" };
    }
    const filenameHint = typeof p?.filename === "string" ? p.filename : undefined;

    const tmpDir = path.join(os.tmpdir(), `openclaw-restore-${randomBytes(8).toString("hex")}`);

    try {
      // Extract archive to temp dir and validate
      const buffer = Buffer.from(b64, "base64");
      await fsp.mkdir(tmpDir, { recursive: true });
      await extractArchiveBuffer(buffer, tmpDir, filenameHint);
      const backupRoot = await resolveBackupRoot(tmpDir);

      await performRestoreFromSourceDir(backupRoot);
      return { ok: true };
    } catch (err) {
      console.error("[ipc/backup] backup-restore failed:", err);
      return { ok: false, error: `Failed to restore backup: ${String(err)}` };
    } finally {
      try {
        await fsp.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // cleanup best-effort
      }
    }
  });

  // ── Detect local OpenClaw instance at ~/.openclaw ─────────────────────
  ipcMain.handle("backup-detect-local", async () => {
    try {
      const openclawDir = path.join(os.homedir(), ".openclaw");
      const configPath = path.join(openclawDir, "openclaw.json");
      const exists = fs.existsSync(configPath);
      return { found: exists, path: openclawDir };
    } catch (err) {
      console.error("[ipc/backup] backup-detect-local failed:", err);
      return { found: false, path: "" };
    }
  });

  // ── Restore from a directory (local instance or user-picked folder) ───
  ipcMain.handle("backup-restore-from-dir", async (_evt, p: { dirPath?: unknown }) => {
    const dirPath = typeof p?.dirPath === "string" ? p.dirPath.trim() : "";
    if (!dirPath) {
      return { ok: false, error: "No directory path provided" };
    }

    try {
      // Validate the directory contains openclaw.json
      const configPath = path.join(dirPath, "openclaw.json");
      if (!fs.existsSync(configPath)) {
        return {
          ok: false,
          error: "Invalid OpenClaw directory: openclaw.json not found",
        };
      }

      await performRestoreFromSourceDir(dirPath);
      return { ok: true };
    } catch (err) {
      console.error("[ipc/backup] backup-restore-from-dir failed:", err);
      return { ok: false, error: `Failed to restore: ${String(err)}` };
    }
  });

  // ── Open folder picker and validate it contains openclaw.json ─────────
  ipcMain.handle("backup-select-folder", async () => {
    try {
      const parentWindow = getMainWindow();
      const dialogOpts = {
        title: "Select OpenClaw Configuration Folder",
        properties: ["openDirectory"] as Array<"openDirectory">,
      };
      const result = parentWindow
        ? await dialog.showOpenDialog(parentWindow, dialogOpts)
        : await dialog.showOpenDialog(dialogOpts);

      if (result.canceled || !result.filePaths[0]) {
        return { ok: false, cancelled: true };
      }

      const selectedDir = result.filePaths[0];
      const configPath = path.join(selectedDir, "openclaw.json");
      if (!fs.existsSync(configPath)) {
        return {
          ok: false,
          error:
            "Selected folder does not contain openclaw.json. Please select a valid OpenClaw configuration directory.",
        };
      }

      return { ok: true, path: selectedDir };
    } catch (err) {
      console.error("[ipc/backup] backup-select-folder failed:", err);
      return { ok: false, error: `Failed to select folder: ${String(err)}` };
    }
  });
}
