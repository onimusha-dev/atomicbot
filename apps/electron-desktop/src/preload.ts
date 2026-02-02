import { contextBridge, ipcRenderer } from "electron";

// Expose only the bare minimum to the renderer. The Control UI is served by the Gateway and
// does not require Electron privileged APIs.
contextBridge.exposeInMainWorld("openclawDesktop", {
  version: "0.0.0",
  openLogs: async () => ipcRenderer.invoke("open-logs"),
  toggleDevTools: async () => ipcRenderer.invoke("devtools-toggle"),
  retry: async () => ipcRenderer.invoke("gateway-retry"),
  resetAndClose: async () => ipcRenderer.invoke("reset-and-close"),
  getGatewayInfo: async () => ipcRenderer.invoke("gateway-get-info"),
  openExternal: async (url: string) => ipcRenderer.invoke("open-external", { url }),
  setAnthropicApiKey: async (apiKey: string) =>
    ipcRenderer.invoke("auth-set-anthropic-api-key", { apiKey }),
  gogAuthList: async () => ipcRenderer.invoke("gog-auth-list"),
  gogAuthAdd: async (params: { account: string; services?: string; noInput?: boolean }) =>
    ipcRenderer.invoke("gog-auth-add", params),
  gogAuthCredentials: async (params: { credentialsJson: string; filename?: string }) =>
    ipcRenderer.invoke("gog-auth-credentials", params),
  onGatewayState: (cb: (state: unknown) => void) => {
    const handler = (_evt: unknown, state: unknown) => cb(state);
    ipcRenderer.on("gateway-state", handler);
    return () => {
      ipcRenderer.removeListener("gateway-state", handler);
    };
  },
});

