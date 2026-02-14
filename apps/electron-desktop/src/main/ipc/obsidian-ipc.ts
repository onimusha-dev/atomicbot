/**
 * IPC handlers for Obsidian CLI and vault operations.
 */
import { ipcMain } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ExecResult } from "../../shared/types";
import type { ObsidianVaultEntry } from "../../shared/types";
import type { RegisterParams } from "./types";
import { createBinaryNotFoundResult, runCommand, runSyncCheck } from "./exec";

const PREPARE_CMD = "cd apps/electron-desktop && npm run prepare:obsidian-cli:all";

/** Parse Obsidian's obsidian.json config to extract vault entries. */
export function parseObsidianVaultsFromJson(payload: unknown): ObsidianVaultEntry[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const root = payload as Record<string, unknown>;
  const vaultsRaw = root.vaults;
  if (!vaultsRaw || typeof vaultsRaw !== "object" || Array.isArray(vaultsRaw)) {
    return [];
  }
  const vaults = vaultsRaw as Record<string, unknown>;
  const openVaultId = typeof root.openVaultId === "string" ? root.openVaultId : null;
  const out: ObsidianVaultEntry[] = [];
  for (const [id, v] of Object.entries(vaults)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      continue;
    }
    const obj = v as Record<string, unknown>;
    const vaultPath = typeof obj.path === "string" ? obj.path.trim() : "";
    if (!vaultPath) {
      continue;
    }
    const isOpen = obj.open === true || (openVaultId ? id === openVaultId : false);
    const name = path.basename(vaultPath);
    out.push({ name, path: vaultPath, open: isOpen });
  }
  out.sort((a, b) => {
    if (a.open !== b.open) {
      return a.open ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return out;
}

export function registerObsidianHandlers(params: RegisterParams) {
  ipcMain.handle("obsidian-cli-check", async () => {
    const obsidianCliBin = params.obsidianCliBin;
    if (!fs.existsSync(obsidianCliBin)) {
      return createBinaryNotFoundResult(obsidianCliBin, PREPARE_CMD);
    }
    return runSyncCheck({
      bin: obsidianCliBin,
      args: ["--help"],
      cwd: params.openclawDir,
    });
  });

  ipcMain.handle("obsidian-cli-print-default-path", async () => {
    const obsidianCliBin = params.obsidianCliBin;
    if (!fs.existsSync(obsidianCliBin)) {
      return createBinaryNotFoundResult(obsidianCliBin, PREPARE_CMD);
    }

    const res = await runCommand({
      bin: obsidianCliBin,
      args: ["print-default", "--path-only"],
      cwd: params.openclawDir,
      timeoutMs: 10_000,
    });

    const defaultPath = res.stdout.trim();
    if (!res.ok) {
      return res;
    }
    if (!defaultPath) {
      return {
        ok: false,
        code: res.code,
        stdout: res.stdout,
        stderr:
          res.stderr ||
          'default vault not set. Run: obsidian-cli set-default "<vault-folder-name>"',
        resolvedPath: res.resolvedPath,
      } satisfies ExecResult;
    }

    try {
      const st = fs.statSync(defaultPath);
      if (!st.isDirectory()) {
        return {
          ok: false,
          code: res.code,
          stdout: res.stdout,
          stderr: `default vault path is not a directory: ${defaultPath}`,
          resolvedPath: res.resolvedPath,
        } satisfies ExecResult;
      }
    } catch (err) {
      console.warn("[ipc/obsidian] default vault path check failed:", err);
      return {
        ok: false,
        code: res.code,
        stdout: res.stdout,
        stderr: `default vault path does not exist: ${defaultPath}`,
        resolvedPath: res.resolvedPath,
      } satisfies ExecResult;
    }

    return {
      ...res,
      stdout: `${defaultPath}\n`,
    } satisfies ExecResult;
  });

  ipcMain.handle("obsidian-vaults-list", async () => {
    const cfgPath = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "obsidian",
      "obsidian.json"
    );
    try {
      if (!fs.existsSync(cfgPath)) {
        return {
          ok: true,
          code: 0,
          stdout: "[]\n",
          stderr: `Obsidian config not found at: ${cfgPath}`,
          resolvedPath: cfgPath,
        } satisfies ExecResult;
      }
      const raw = fs.readFileSync(cfgPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      const vaults = parseObsidianVaultsFromJson(parsed);
      return {
        ok: true,
        code: 0,
        stdout: `${JSON.stringify(vaults, null, 2)}\n`,
        stderr: "",
        resolvedPath: cfgPath,
      } satisfies ExecResult;
    } catch (err) {
      return {
        ok: false,
        code: null,
        stdout: "",
        stderr: `failed to read Obsidian vaults: ${String(err)}`,
        resolvedPath: cfgPath,
      } satisfies ExecResult;
    }
  });

  ipcMain.handle("obsidian-cli-set-default", async (_evt, p: { vaultName?: unknown }) => {
    const obsidianCliBin = params.obsidianCliBin;
    const vaultName = typeof p?.vaultName === "string" ? p.vaultName.trim() : "";
    if (!vaultName) {
      return {
        ok: false,
        code: null,
        stdout: "",
        stderr: "vaultName is required",
        resolvedPath: obsidianCliBin,
      } satisfies ExecResult;
    }
    if (!fs.existsSync(obsidianCliBin)) {
      return createBinaryNotFoundResult(obsidianCliBin, PREPARE_CMD);
    }

    return await runCommand({
      bin: obsidianCliBin,
      args: ["set-default", vaultName],
      cwd: params.openclawDir,
      timeoutMs: 10_000,
    });
  });
}
