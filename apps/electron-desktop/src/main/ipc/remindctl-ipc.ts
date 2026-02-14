/**
 * IPC handlers for remindctl binary operations.
 */
import { ipcMain } from "electron";
import fs from "node:fs";

import type { ExecResult } from "../../shared/types";
import type { RegisterParams } from "./types";
import { createBinaryNotFoundResult, runCommand } from "./exec";

const PREPARE_CMD = "cd apps/electron-desktop && npm run prepare:remindctl:all";

export function registerRemindctlHandlers(params: RegisterParams) {
  ipcMain.handle("remindctl-authorize", async () => {
    const remindctlBin = params.remindctlBin;
    if (!fs.existsSync(remindctlBin)) {
      return createBinaryNotFoundResult(remindctlBin, PREPARE_CMD);
    }
    return await runCommand({
      bin: remindctlBin,
      args: ["authorize"],
      cwd: params.openclawDir,
      timeoutMs: 120_000,
    });
  });

  ipcMain.handle("remindctl-today-json", async () => {
    const remindctlBin = params.remindctlBin;
    if (!fs.existsSync(remindctlBin)) {
      return createBinaryNotFoundResult(remindctlBin, PREPARE_CMD);
    }
    return await runCommand({
      bin: remindctlBin,
      args: ["today", "--json"],
      cwd: params.openclawDir,
      timeoutMs: 20_000,
    });
  });
}
