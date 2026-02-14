/**
 * IPC handlers for file/folder operations and devtools.
 */
import { ipcMain, shell } from "electron";
import fs from "node:fs";
import path from "node:path";

import type { RegisterParams } from "./types";

export function registerFileHandlers(params: RegisterParams) {
  ipcMain.handle("open-logs", async () => {
    const logsDir = params.getLogsDir();
    if (!logsDir) {
      return;
    }
    await shell.openPath(logsDir);
  });

  ipcMain.handle("open-workspace-folder", async () => {
    const workspaceDir = path.join(params.stateDir, "workspace");
    try {
      fs.mkdirSync(workspaceDir, { recursive: true });
    } catch (err) {
      console.warn("[ipc/files] mkdir workspace failed:", err);
    }
    await shell.openPath(workspaceDir);
  });

  ipcMain.handle("open-openclaw-folder", async () => {
    try {
      fs.mkdirSync(params.stateDir, { recursive: true });
    } catch (err) {
      console.warn("[ipc/files] mkdir stateDir failed:", err);
    }
    await shell.openPath(params.stateDir);
  });

  ipcMain.handle("devtools-toggle", async () => {
    const win = params.getMainWindow();
    if (!win || win.isDestroyed()) {
      return;
    }
    const wc = win.webContents;
    if (wc.isDevToolsOpened()) {
      wc.closeDevTools();
    } else {
      wc.openDevTools({ mode: "detach" });
    }
  });

  ipcMain.handle("open-external", async (_evt, p: { url?: unknown }) => {
    const url = typeof p?.url === "string" ? p.url : "";
    if (!url) {
      return;
    }
    await shell.openExternal(url);
  });
}
