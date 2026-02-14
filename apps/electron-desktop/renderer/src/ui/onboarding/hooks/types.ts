export type ConfigSnapshot = {
  path?: string;
  exists?: boolean;
  valid?: boolean;
  hash?: string;
  config?: unknown;
};

export type GatewayRpcLike = {
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
};

export type ChannelsStatusResult = {
  channelAccounts?: Record<
    string,
    Array<{ accountId?: string; configured?: boolean; lastError?: string }>
  >;
};

export type GogExecResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
};

export type ModelsListResult = {
  models?: Array<{
    id: string;
    name?: string;
    provider: string;
    contextWindow?: number;
    reasoning?: boolean;
  }>;
};

export type SkillId =
  | "google-workspace"
  | "media-understanding"
  | "web-search"
  | "notion"
  | "trello"
  | "apple-notes"
  | "apple-reminders"
  | "obsidian"
  | "github"
  | "slack";

/** Signature of the `run` wrapper from `useAsyncAction`. */
export type AsyncRunner = <T>(fn: () => Promise<T>) => Promise<T | undefined>;
