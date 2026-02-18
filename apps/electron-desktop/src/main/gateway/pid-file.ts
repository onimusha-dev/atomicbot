import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const PID_FILENAME = "gateway.pid";

/**
 * Write the gateway child PID to a file so we can clean up orphans on next launch.
 */
export function writeGatewayPid(stateDir: string, pid: number): void {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, PID_FILENAME), String(pid), "utf-8");
  } catch (err) {
    console.warn("[pid-file] writeGatewayPid failed:", err);
  }
}

/**
 * Remove the gateway PID file (called on clean shutdown).
 */
export function removeGatewayPid(stateDir: string): void {
  try {
    fs.unlinkSync(path.join(stateDir, PID_FILENAME));
  } catch {
    // File may not exist — that's fine.
  }
}

/**
 * Read a previously written PID and kill the orphaned process if it is still alive.
 * Returns the killed PID (or null if nothing was running).
 */
export function killOrphanedGateway(stateDir: string): number | null {
  const pidPath = path.join(stateDir, PID_FILENAME);
  let raw: string;
  try {
    raw = fs.readFileSync(pidPath, "utf-8").trim();
  } catch {
    return null;
  }
  console.log("raw>>>>>>", raw);
  const pid = Number(raw);
  if (!Number.isFinite(pid) || pid <= 0) {
    removeGatewayPid(stateDir);
    return null;
  }

  // Check if the process is still alive.
  try {
    process.kill(pid, 0); // signal 0 = existence check, no actual signal sent
  } catch {
    // Process is not running — clean up the stale PID file.
    removeGatewayPid(stateDir);
    return null;
  }

  // Process is alive — kill the entire process group immediately.
  console.warn(`[pid-file] Killing orphaned gateway process group (PID ${pid})`);
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // Group kill failed — fall back to single-process kill.
    try {
      process.kill(pid, "SIGKILL");
    } catch (err) {
      console.warn("[pid-file] SIGKILL failed:", err);
    }
  }

  // Brief wait to confirm the process is dead.
  try {
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      try {
        process.kill(pid, 0);
      } catch {
        // Dead — done.
        removeGatewayPid(stateDir);
        return pid;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  } catch (err) {
    console.warn("[pid-file] kill confirmation failed:", err);
  }

  removeGatewayPid(stateDir);
  return pid;
}

/**
 * Remove the gateway singleton lock file so the next spawn can acquire it.
 * The lock lives at: os.tmpdir()/openclaw-<uid>/gateway.<hash>.lock
 * where <hash> = sha1(configPath).slice(0, 8).
 */
export function removeStaleGatewayLock(configPath: string): void {
  try {
    const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
    const suffix = uid != null ? `openclaw-${uid}` : "openclaw";
    const lockDir = path.join(os.tmpdir(), suffix);
    const hash = createHash("sha1").update(configPath).digest("hex").slice(0, 8);
    const lockPath = path.join(lockDir, `gateway.${hash}.lock`);

    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
      console.log(`[pid-file] Removed stale gateway lock: ${lockPath}`);
    }
  } catch (err) {
    console.warn("[pid-file] removeStaleGatewayLock failed:", err);
  }
}
