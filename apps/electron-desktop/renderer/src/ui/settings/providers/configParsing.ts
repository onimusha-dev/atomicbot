import type { ModelProvider } from "@shared/models/providers";
import type { ConfigData } from "@store/slices/configSlice";

/** Extract the primary default model ID from config. */
export function getDefaultModelPrimary(cfg: ConfigData | undefined): string | null {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
    return null;
  }
  const primary = cfg.agents?.defaults?.model?.primary;
  const raw = typeof primary === "string" ? primary.trim() : "";
  return raw ? raw : null;
}

/** Extract the set of providers that have entries in auth.order. */
export function getConfiguredProviders(cfg: ConfigData | undefined): Set<ModelProvider> {
  const out = new Set<ModelProvider>();
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
    return out;
  }
  const order = cfg.auth?.order;
  if (!order || typeof order !== "object" || Array.isArray(order)) {
    return out;
  }
  for (const [provider, ids] of Object.entries(order)) {
    if (!Array.isArray(ids)) {
      continue;
    }
    const list = ids.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
    if (list.length === 0) {
      continue;
    }
    const normalized = provider.trim().toLowerCase();
    if (
      normalized === "anthropic" ||
      normalized === "openrouter" ||
      normalized === "google" ||
      normalized === "openai" ||
      normalized === "zai" ||
      normalized === "minimax"
    ) {
      out.add(normalized as ModelProvider);
    }
  }
  return out;
}
