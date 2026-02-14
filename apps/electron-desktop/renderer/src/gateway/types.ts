/** Typed interfaces for gateway RPC method responses. */

export interface ConfigGetResponse {
  path?: string;
  exists?: boolean;
  valid?: boolean;
  hash?: string;
  config?: Record<string, unknown>;
}

export interface SessionEntry {
  key: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  modelOverride?: string;
}

export interface SessionsListResponse {
  sessions?: SessionEntry[];
}

export interface ModelsListResponse {
  models?: Array<{
    id: string;
    name?: string;
    provider: string;
    contextWindow?: number;
    reasoning?: boolean;
  }>;
}
