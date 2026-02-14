/**
 * Shared exec helpers for IPC handlers that run external binaries.
 * Extracted from register.ts to eliminate duplication.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";

import type { ExecResult } from "../../shared/types";

/**
 * Create a standardized "binary not found" ExecResult.
 * Replaces 10+ copy-pasted blocks across IPC handlers.
 */
export function createBinaryNotFoundResult(
  binPath: string,
  prepareCmd: string
): ExecResult {
  return {
    ok: false,
    code: null,
    stdout: "",
    stderr: `${binPath.split("/").pop()} binary not found at: ${binPath}\nRun: ${prepareCmd}`,
    resolvedPath: null,
  };
}

/**
 * Check if a binary exists; if not, return a not-found result.
 * Returns null when binary exists (caller should proceed).
 */
export function checkBinaryExists(
  binPath: string,
  prepareCmd: string
): ExecResult | null {
  if (!fs.existsSync(binPath)) {
    return createBinaryNotFoundResult(binPath, prepareCmd);
  }
  return null;
}

/**
 * Run a binary synchronously and return an ExecResult.
 * Used for quick --help / --version checks.
 */
export function runSyncCheck(params: {
  bin: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
}): ExecResult {
  const res = spawnSync(params.bin, params.args, {
    encoding: "utf-8",
    cwd: params.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: params.env,
  });
  const stdout = String(res.stdout || "");
  const stderr = String(res.stderr || "");
  const ok = res.status === 0;
  return {
    ok,
    code: typeof res.status === "number" ? res.status : null,
    stdout,
    stderr,
    resolvedPath: params.bin,
  };
}

/**
 * Run a command asynchronously with a timeout.
 * Merges the former runCommandWithTimeout and runCommandWithInputTimeout.
 * Pass `input` to write to stdin before waiting.
 */
export function runCommand(params: {
  bin: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  input?: string;
}): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(params.bin, params.args, {
      cwd: params.cwd,
      env: params.env,
      stdio: [params.input !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const onStdout = (chunk: Buffer | string) => {
      stdout += String(chunk);
    };
    const onStderr = (chunk: Buffer | string) => {
      stderr += String(chunk);
    };
    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);

    // Feed stdin if provided
    if (params.input !== undefined) {
      try {
        child.stdin?.write(params.input);
        child.stdin?.end();
      } catch (err) {
        console.warn("[ipc/exec] stdin write failed:", err);
      }
    }

    let settled = false;
    const settle = (result: ExecResult) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        child.stdout?.off("data", onStdout);
        child.stderr?.off("data", onStderr);
      } catch (err) {
        console.warn("[ipc/exec] stdout/stderr off failed:", err);
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch (err) {
        console.warn("[ipc/exec] timeout kill failed:", err);
      }
      settle({
        ok: false,
        code: null,
        stdout,
        stderr: `${stderr}${stderr.trim() ? "\n" : ""}timeout after ${params.timeoutMs}ms`,
        resolvedPath: params.bin,
      });
    }, params.timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      settle({
        ok: code === 0,
        code: typeof code === "number" ? code : null,
        stdout,
        stderr,
        resolvedPath: params.bin,
      });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      settle({
        ok: false,
        code: null,
        stdout,
        stderr: `${stderr}${stderr.trim() ? "\n" : ""}${String(err)}`,
        resolvedPath: params.bin,
      });
    });
  });
}
