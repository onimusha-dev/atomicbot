/**
 * IPC handlers for API key management and auth profiles.
 */
import { ipcMain } from "electron";

import { upsertApiKeyProfile } from "../keys/apiKeys";
import { readAuthProfilesStore, resolveAuthProfilesPath } from "../keys/authProfilesStore";
import type { RegisterParams } from "./types";

export function registerKeyHandlers(params: RegisterParams) {
  ipcMain.handle("auth-set-api-key", async (_evt, p: { provider?: unknown; apiKey?: unknown }) => {
    const provider = typeof p?.provider === "string" ? p.provider.trim() : "";
    const apiKey = typeof p?.apiKey === "string" ? p.apiKey : "";
    if (!provider) {
      throw new Error("provider is required");
    }
    upsertApiKeyProfile({
      stateDir: params.stateDir,
      provider,
      key: apiKey,
      profileName: "default",
    });
    return { ok: true } as const;
  });

  ipcMain.handle(
    "auth-validate-api-key",
    async (_evt, p: { provider?: unknown; apiKey?: unknown }) => {
      const provider = typeof p?.provider === "string" ? p.provider.trim() : "";
      const apiKey = typeof p?.apiKey === "string" ? p.apiKey : "";
      if (!provider) {
        return { valid: false, error: "provider is required" };
      }
      if (!apiKey) {
        return { valid: false, error: "API key is required" };
      }
      const { validateProviderApiKey } = await import("../keys/validateApiKey");
      return validateProviderApiKey(provider, apiKey);
    }
  );

  ipcMain.handle("auth-has-api-key", async (_evt, p: { provider?: unknown }) => {
    const provider = typeof p?.provider === "string" ? p.provider.trim().toLowerCase() : "";
    if (!provider) {
      throw new Error("provider is required");
    }
    const authProfilesPath = resolveAuthProfilesPath({ stateDir: params.stateDir });
    const store = readAuthProfilesStore({ authProfilesPath });
    const configured = Object.values(store.profiles).some(
      (profile) =>
        profile.type === "api_key" && profile.provider === provider && profile.key.trim().length > 0
    );
    return { configured } as const;
  });
}
