/**
 * IPC contract test: verifies that registerIpcHandlers registers all expected channels.
 * This is the most critical safety net for the register.ts split refactoring.
 * If any channel is lost during extraction, this test breaks immediately.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ipcMain } from "electron";

import { registerIpcHandlers } from "./register";

/** All IPC channels that must be registered by registerIpcHandlers + sub-registrations. */
const EXPECTED_CHANNELS = [
  // files
  "open-logs",
  "open-workspace-folder",
  "open-openclaw-folder",
  "devtools-toggle",
  "open-external",
  // gateway / consent / app
  "gateway-get-info",
  "consent-get",
  "consent-accept",
  "gateway-start",
  "gateway-retry",
  // auth
  "auth-set-api-key",
  "auth-validate-api-key",
  "auth-has-api-key",
  // memo
  "memo-check",
  // remindctl
  "remindctl-authorize",
  "remindctl-today-json",
  // obsidian
  "obsidian-cli-check",
  "obsidian-cli-print-default-path",
  "obsidian-vaults-list",
  "obsidian-cli-set-default",
  // gh
  "gh-check",
  "gh-auth-login-pat",
  "gh-auth-status",
  "gh-api-user",
  // config
  "config-read",
  "config-write",
  "launch-at-login-get",
  "launch-at-login-set",
  "get-app-version",
  // updater
  "fetch-release-notes",
  "updater-check",
  "updater-download",
  "updater-install",
  // skills
  "install-custom-skill",
  "list-custom-skills",
  "remove-custom-skill",
  // gog (registered by registerGogIpcHandlers)
  "gog-auth-list",
  "gog-auth-add",
  "gog-auth-credentials",
  // reset (registered by registerResetAndCloseIpcHandler)
  "reset-and-close",
];

describe("IPC channel contracts", () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockReset();
  });

  it("registers all expected channels", () => {
    const mockParams = {
      getMainWindow: () => null,
      getGatewayState: () => null,
      getLogsDir: () => "/tmp/logs",
      getConsentAccepted: () => true,
      acceptConsent: vi.fn(async () => {}),
      startGateway: vi.fn(async () => {}),
      userData: "/tmp/user",
      stateDir: "/tmp/state",
      logsDir: "/tmp/logs",
      openclawDir: "/tmp/openclaw",
      gogBin: "/bin/gog",
      memoBin: "/bin/memo",
      remindctlBin: "/bin/remindctl",
      obsidianCliBin: "/bin/obsidian-cli",
      ghBin: "/bin/gh",
      stopGatewayChild: vi.fn(async () => {}),
    };

    registerIpcHandlers(mockParams);

    const registeredChannels = vi
      .mocked(ipcMain.handle)
      .mock.calls.map((call) => call[0]);

    for (const channel of EXPECTED_CHANNELS) {
      expect(registeredChannels, `Missing IPC channel: ${channel}`).toContain(channel);
    }
  });

  it("does not register unexpected channels", () => {
    const mockParams = {
      getMainWindow: () => null,
      getGatewayState: () => null,
      getLogsDir: () => "/tmp/logs",
      getConsentAccepted: () => true,
      acceptConsent: vi.fn(async () => {}),
      startGateway: vi.fn(async () => {}),
      userData: "/tmp/user",
      stateDir: "/tmp/state",
      logsDir: "/tmp/logs",
      openclawDir: "/tmp/openclaw",
      gogBin: "/bin/gog",
      memoBin: "/bin/memo",
      remindctlBin: "/bin/remindctl",
      obsidianCliBin: "/bin/obsidian-cli",
      ghBin: "/bin/gh",
      stopGatewayChild: vi.fn(async () => {}),
    };

    registerIpcHandlers(mockParams);

    const registeredChannels = vi
      .mocked(ipcMain.handle)
      .mock.calls.map((call) => call[0]);

    for (const channel of registeredChannels) {
      expect(EXPECTED_CHANNELS, `Unexpected IPC channel registered: ${channel}`).toContain(
        channel
      );
    }
  });
});
