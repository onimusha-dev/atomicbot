export {};

declare global {
  type GatewayState =
    | { kind: "starting"; port: number; logsDir: string; token: string }
    | { kind: "ready"; port: number; logsDir: string; url: string; token: string }
    | { kind: "failed"; port: number; logsDir: string; details: string; token: string };

  interface Window {
    openclawDesktop?: {
      version: string;
      openLogs: () => Promise<void>;
      toggleDevTools: () => Promise<void>;
      retry: () => Promise<void>;
      resetAndClose: () => Promise<{ ok: true; warnings?: string[] }>;
      getGatewayInfo: () => Promise<{ state: GatewayState | null }>;
      openExternal: (url: string) => Promise<void>;
      setAnthropicApiKey: (apiKey: string) => Promise<{ ok: true }>;
      gogAuthList: () => Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string }>;
      gogAuthAdd: (params: {
        account: string;
        services?: string;
        noInput?: boolean;
      }) => Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string }>;
      gogAuthCredentials: (params: {
        credentialsJson: string;
        filename?: string;
      }) => Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string }>;
      onGatewayState: (cb: (state: GatewayState) => void) => () => void;
    };
  }
}

