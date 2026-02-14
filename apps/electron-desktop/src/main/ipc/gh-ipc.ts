/**
 * IPC handlers for GitHub CLI (gh) operations.
 */
import { ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";

import type { ExecResult } from "../../shared/types";
import type { RegisterParams } from "./types";
import { createBinaryNotFoundResult, runCommand, runSyncCheck } from "./exec";

const PREPARE_CMD = "cd apps/electron-desktop && npm run prepare:gh:all";

export function registerGhHandlers(params: RegisterParams) {
  ipcMain.handle("gh-check", async () => {
    const ghBin = params.ghBin;
    if (!fs.existsSync(ghBin)) {
      return createBinaryNotFoundResult(ghBin, PREPARE_CMD);
    }
    return runSyncCheck({
      bin: ghBin,
      args: ["--version"],
      cwd: params.openclawDir,
      env: { ...process.env, GH_CONFIG_DIR: path.join(params.stateDir, "gh") },
    });
  });

  ipcMain.handle("gh-auth-login-pat", async (_evt, p: { pat?: unknown }) => {
    const ghBin = params.ghBin;
    const pat = typeof p?.pat === "string" ? p.pat : "";
    if (!pat) {
      return {
        ok: false,
        code: null,
        stdout: "",
        stderr: "PAT is required",
        resolvedPath: ghBin,
      } satisfies ExecResult;
    }
    if (!fs.existsSync(ghBin)) {
      return createBinaryNotFoundResult(ghBin, PREPARE_CMD);
    }
    const ghConfigDir = path.join(params.stateDir, "gh");
    try {
      fs.mkdirSync(ghConfigDir, { recursive: true });
    } catch (err) {
      console.warn("[ipc/gh] mkdir ghConfigDir failed:", err);
    }
    return await runCommand({
      bin: ghBin,
      args: ["auth", "login", "--hostname", "github.com", "--with-token"],
      input: pat.endsWith("\n") ? pat : `${pat}\n`,
      cwd: params.openclawDir,
      env: { ...process.env, GH_CONFIG_DIR: ghConfigDir },
      timeoutMs: 30_000,
    });
  });

  ipcMain.handle("gh-auth-status", async () => {
    const ghBin = params.ghBin;
    if (!fs.existsSync(ghBin)) {
      return createBinaryNotFoundResult(ghBin, PREPARE_CMD);
    }
    const ghConfigDir = path.join(params.stateDir, "gh");
    try {
      fs.mkdirSync(ghConfigDir, { recursive: true });
    } catch (err) {
      console.warn("[ipc/gh] mkdir ghConfigDir failed:", err);
    }
    return await runCommand({
      bin: ghBin,
      args: ["auth", "status", "--hostname", "github.com"],
      cwd: params.openclawDir,
      env: { ...process.env, GH_CONFIG_DIR: ghConfigDir },
      timeoutMs: 15_000,
    });
  });

  ipcMain.handle("gh-api-user", async () => {
    const ghBin = params.ghBin;
    if (!fs.existsSync(ghBin)) {
      return createBinaryNotFoundResult(ghBin, PREPARE_CMD);
    }
    const ghConfigDir = path.join(params.stateDir, "gh");
    try {
      fs.mkdirSync(ghConfigDir, { recursive: true });
    } catch (err) {
      console.warn("[ipc/gh] mkdir ghConfigDir failed:", err);
    }
    return await runCommand({
      bin: ghBin,
      args: ["api", "user"],
      cwd: params.openclawDir,
      env: { ...process.env, GH_CONFIG_DIR: ghConfigDir },
      timeoutMs: 15_000,
    });
  });
}
