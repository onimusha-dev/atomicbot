/**
 * Central IPC handler orchestrator.
 * Each domain has been extracted into its own module; this file
 * composes them all into a single registration call.
 */
import { registerGogIpcHandlers } from "../gog/ipc";
import { registerResetAndCloseIpcHandler } from "../reset/ipc";

import type { RegisterParams } from "./types";
import { registerFileHandlers } from "./files";
import { registerKeyHandlers } from "./keys-ipc";
import { registerMemoHandlers } from "./memo-ipc";
import { registerRemindctlHandlers } from "./remindctl-ipc";
import { registerObsidianHandlers } from "./obsidian-ipc";
import { registerGhHandlers } from "./gh-ipc";
import { registerConfigHandlers } from "./config-ipc";
import { registerUpdaterIpcHandlers } from "./updater-ipc";
import { registerSkillHandlers } from "./skills-ipc";

export { type RegisterParams } from "./types";

export function registerIpcHandlers(params: RegisterParams) {
  registerFileHandlers(params);
  registerKeyHandlers(params);
  registerMemoHandlers(params);
  registerRemindctlHandlers(params);
  registerObsidianHandlers(params);
  registerGhHandlers(params);
  registerConfigHandlers(params);
  registerUpdaterIpcHandlers();
  registerSkillHandlers(params);

  registerGogIpcHandlers({
    gogBin: params.gogBin,
    openclawDir: params.openclawDir,
    userData: params.userData,
    gogCredentialsPath: "",
  });
  registerResetAndCloseIpcHandler({
    userData: params.userData,
    stateDir: params.stateDir,
    logsDir: params.logsDir,
    gogBin: params.gogBin,
    openclawDir: params.openclawDir,
    stopGatewayChild: params.stopGatewayChild,
  });
}
