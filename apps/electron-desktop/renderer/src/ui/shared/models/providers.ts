export type ModelProvider =
  | "anthropic"
  | "google"
  | "openai"
  | "openai-codex"
  | "openrouter"
  | "xai"
  | "zai"
  | "minimax"
  | "moonshot"
  | "kimi-coding";

export type ModelProviderInfo = {
  id: ModelProvider;
  name: string;
  description: string;
  recommended?: boolean;
  /** Placeholder text for the API key input. Not needed for OAuth providers. */
  placeholder?: string;
  popular?: boolean;
  helpUrl?: string;
  helpText?: string;
  /** Authentication type. Defaults to "api_key" when omitted. */
  authType?: "api_key" | "oauth";
};

export const PROVIDER_ICONS: Record<ModelProvider, string> = {
  anthropic: "anthropic.svg",
  // Note: filename kept as-is to match assets folder.
  openai: "openai.svg",
  "openai-codex": "openai-codex.svg",
  google: "gemini.svg",
  minimax: "minimax.svg",
  xai: "xai.svg",
  zai: "zai.svg",
  openrouter: "openrouter.svg",
  moonshot: "moonshot.svg",
  "kimi-coding": "kimi-coding.svg",
};

export function resolveProviderIconUrl(provider: ModelProvider): string {
  // Resolve relative to renderer's index.html (renderer/dist/index.html -> ../../assets/)
  return new URL(
    `../../assets/ai-providers/${PROVIDER_ICONS[provider]}`,
    document.baseURI
  ).toString();
}

export const MODEL_PROVIDERS: ModelProviderInfo[] = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    description: "Best for complex reasoning, long-form writing and precise instructions",
    recommended: true,
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpText: "Get your API key from the Anthropic Console.",
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    description: "Kimi K2.5 with 256K context window for complex reasoning and coding",
    popular: true,
    placeholder: "sk-...",
    helpUrl: "https://platform.moonshot.cn/console/api-keys",
    helpText: "Get your API key from the Moonshot AI Platform.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "One gateway to 200+ AI models. Ideal for flexibility and experimentation",
    popular: true,
    placeholder: "sk-or-...",
    helpUrl: "https://openrouter.ai/keys",
    helpText: "Get your API key from OpenRouter.",
  },
  {
    id: "google",
    name: "Google (Gemini)",
    description: "Strong with images, documents and large amounts of context",
    placeholder: "AIza...",
    helpUrl: "https://aistudio.google.com/apikey",
    helpText: "Get your API key from Google AI Studio.",
  },
  {
    id: "openai",
    name: "OpenAI (API Key)",
    description: "An all-rounder for chat, coding, and everyday tasks",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Get your API key from the OpenAI Platform.",
  },
  {
    id: "openai-codex",
    name: "ChatGPT (Subscription)",
    description: "Use your ChatGPT subscription for coding models",
    authType: "oauth",
    helpUrl: "https://openai.com/codex/",
    helpText: "Sign in with your ChatGPT account.",
  },
  {
    id: "kimi-coding",
    name: "Kimi Coding",
    description: "Dedicated coding endpoint with Kimi K2.5 optimized for development tasks",
    placeholder: "sk-...",
    helpUrl: "https://www.kimi.com/code/en",
    helpText: "Get your API key from the Kimi Coding Platform.",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    description: "High-performance reasoning model by xAI with web search capabilities",
    placeholder: "xai-...",
    helpUrl: "https://console.x.ai/",
    helpText: "Get your API key from the xAI Console.",
  },
  {
    id: "zai",
    name: "Z.ai (GLM)",
    description: "Cost-effective models for everyday tasks and high-volume usage",
    placeholder: "sk-...",
    helpUrl: "https://z.ai/manage-apikey/apikey-list",
    helpText: "Get your API key from the Z.AI Platform.",
  },
  {
    id: "minimax",
    name: "MiniMax",
    description: "Good for creative writing and expressive conversations",
    placeholder: "sk-...",
    helpUrl: "https://platform.minimax.io/user-center/basic-information/interface-key",
    helpText: "Get your API key from the MiniMax Platform.",
  },
];

export const MODEL_PROVIDER_BY_ID: Record<ModelProvider, ModelProviderInfo> = {
  anthropic: MODEL_PROVIDERS.find((p) => p.id === "anthropic")!,
  openrouter: MODEL_PROVIDERS.find((p) => p.id === "openrouter")!,
  google: MODEL_PROVIDERS.find((p) => p.id === "google")!,
  openai: MODEL_PROVIDERS.find((p) => p.id === "openai")!,
  "openai-codex": MODEL_PROVIDERS.find((p) => p.id === "openai-codex")!,
  xai: MODEL_PROVIDERS.find((p) => p.id === "xai")!,
  zai: MODEL_PROVIDERS.find((p) => p.id === "zai")!,
  minimax: MODEL_PROVIDERS.find((p) => p.id === "minimax")!,
  moonshot: MODEL_PROVIDERS.find((p) => p.id === "moonshot")!,
  "kimi-coding": MODEL_PROVIDERS.find((p) => p.id === "kimi-coding")!,
};
