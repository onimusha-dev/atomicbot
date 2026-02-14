/**
 * IPC handler for memo binary check.
 */
import { ipcMain } from "electron";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

import type { RegisterParams } from "./types";
import { createBinaryNotFoundResult } from "./exec";

export function registerMemoHandlers(params: RegisterParams) {
  ipcMain.handle("memo-check", async () => {
    const memoBin = params.memoBin;
    if (!fs.existsSync(memoBin)) {
      return createBinaryNotFoundResult(
        memoBin,
        "cd apps/electron-desktop && npm run prepare:memo:all"
      );
    }
    const res = spawnSync(memoBin, ["--help"], {
      encoding: "utf-8",
      cwd: params.openclawDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = String(res.stdout || "");
    const stderr = String(res.stderr || "");
    const ok = res.status === 0;
    return {
      ok,
      code: typeof res.status === "number" ? res.status : null,
      stdout,
      stderr,
      resolvedPath: memoBin,
    } as const;
  });
}
