/**
 * Preload contract test: verifies that contextBridge.exposeInMainWorld is called
 * with the correct API shape, matching the OpenclawDesktopApi contract.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contextBridge } from "electron";

describe("preload API contract", () => {
  beforeEach(() => {
    vi.mocked(contextBridge.exposeInMainWorld).mockReset();
  });

  it("exposes openclawDesktop with all expected methods", async () => {
    // Import preload to trigger the contextBridge call
    await import("./preload");

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [name, api] = vi.mocked(contextBridge.exposeInMainWorld).mock.calls[0];

    expect(name).toBe("openclawDesktop");
    expect(typeof api).toBe("object");

    const desktopApi = api as Record<string, unknown>;

    // Core methods
    const expectedMethods = [
      "version",
      "openLogs",
      "openWorkspaceFolder",
      "openOpenclawFolder",
      "toggleDevTools",
      "retry",
      "resetAndClose",
      "getGatewayInfo",
      "getConsentInfo",
      "acceptConsent",
      "startGateway",
      "openExternal",
      "setApiKey",
      "validateApiKey",
      "authHasApiKey",
      "gogAuthList",
      "gogAuthAdd",
      "gogAuthCredentials",
      "memoCheck",
      "remindctlAuthorize",
      "remindctlTodayJson",
      "obsidianCliCheck",
      "obsidianCliPrintDefaultPath",
      "obsidianVaultsList",
      "obsidianCliSetDefault",
      "ghCheck",
      "ghAuthLoginPat",
      "ghAuthStatus",
      "ghApiUser",
      "onGatewayState",
      "readConfig",
      "writeConfig",
      "getLaunchAtLogin",
      "setLaunchAtLogin",
      "getAppVersion",
      "fetchReleaseNotes",
      "checkForUpdate",
      "downloadUpdate",
      "installUpdate",
      "onUpdateAvailable",
      "onUpdateDownloadProgress",
      "onUpdateDownloaded",
      "onUpdateError",
      "installCustomSkill",
      "listCustomSkills",
      "removeCustomSkill",
      "terminalCreate",
      "terminalWrite",
      "terminalResize",
      "terminalKill",
      "terminalList",
      "terminalGetBuffer",
      "onTerminalData",
      "onTerminalExit",
    ];

    for (const method of expectedMethods) {
      expect(desktopApi, `Missing API method: ${method}`).toHaveProperty(method);
    }

    // Verify no extra unknown methods (beyond what we declared)
    const allKeys = Object.keys(desktopApi);
    for (const key of allKeys) {
      expect(expectedMethods, `Unexpected API method: ${key}`).toContain(key);
    }
  });
});
