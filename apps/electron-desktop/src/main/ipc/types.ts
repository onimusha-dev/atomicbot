/**
 * Shared parameter type for IPC handler registration functions.
 */
import type { BrowserWindow } from "electron";
import type { GatewayState } from "../types";

export type RegisterParams = {
  getMainWindow: () => BrowserWindow | null;
  getGatewayState: () => GatewayState | null;
  getLogsDir: () => string | null;
  getConsentAccepted: () => boolean;
  acceptConsent: () => Promise<void>;
  startGateway: () => Promise<void>;
  userData: string;
  stateDir: string;
  logsDir: string;
  openclawDir: string;
  gogBin: string;
  memoBin: string;
  remindctlBin: string;
  obsidianCliBin: string;
  ghBin: string;
  stopGatewayChild: () => Promise<void>;
};
