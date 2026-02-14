import React from "react";

import { getDesktopApiOrNull } from "@ipc/desktopApi";
import {
  MODEL_PROVIDER_BY_ID,
  MODEL_PROVIDERS,
  type ModelProvider,
} from "@shared/models/providers";
import {
  formatModelMeta,
  getModelTier,
  type ModelEntry,
  sortModelsByProviderTierName,
} from "@shared/models/modelPresentation";
import type { ConfigData } from "@store/slices/configSlice";
import { getDefaultModelPrimary, getConfiguredProviders } from "./configParsing";

type GatewayRpc = {
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
};

type ConfigSnapshotLike = {
  hash?: string;
  config?: ConfigData;
};

export function useModelProvidersState(props: {
  gw: GatewayRpc;
  configSnap: ConfigSnapshotLike | null;
  reload: () => Promise<void>;
  onError: (value: string | null) => void;
}) {
  const [busyProvider, setBusyProvider] = React.useState<ModelProvider | null>(null);
  const [modalProvider, setModalProvider] = React.useState<ModelProvider | null>(null);

  const [models, setModels] = React.useState<ModelEntry[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(false);
  const [modelsError, setModelsError] = React.useState<string | null>(null);
  const [modelSearch, setModelSearch] = React.useState("");
  const [modelBusy, setModelBusy] = React.useState(false);
  const [modelStatus, setModelStatus] = React.useState<string | null>(null);
  const [keyConfiguredProviders, setKeyConfiguredProviders] =
    React.useState<Set<ModelProvider> | null>(null);
  const [providerFilter, setProviderFilter] = React.useState<ModelProvider | null>(null);

  // ── Derived state ──────────────────────────────────────────────

  const activeModelId = React.useMemo(
    () => getDefaultModelPrimary(props.configSnap?.config),
    [props.configSnap?.config]
  );

  const configuredProviders = React.useMemo(
    () => getConfiguredProviders(props.configSnap?.config),
    [props.configSnap?.config]
  );

  const strictConfiguredProviders = React.useMemo(() => {
    if (!keyConfiguredProviders) {
      return configuredProviders;
    }
    const out = new Set<ModelProvider>();
    for (const p of configuredProviders) {
      if (keyConfiguredProviders.has(p)) {
        out.add(p);
      }
    }
    return out;
  }, [configuredProviders, keyConfiguredProviders]);

  const sortedModels = React.useMemo(() => sortModelsByProviderTierName(models), [models]);

  const visibleProviders = React.useMemo(() => {
    if (providerFilter === null) {
      return strictConfiguredProviders;
    }
    if (strictConfiguredProviders.has(providerFilter)) {
      return new Set<ModelProvider>([providerFilter]);
    }
    return strictConfiguredProviders;
  }, [providerFilter, strictConfiguredProviders]);

  const modalProviderInfo = React.useMemo(
    () => (modalProvider ? (MODEL_PROVIDERS.find((p) => p.id === modalProvider) ?? null) : null),
    [modalProvider]
  );

  const activeProviderKey = React.useMemo(() => {
    const id = activeModelId ?? "";
    const idx = id.indexOf("/");
    return idx > 0 ? (id.slice(0, idx).trim().toLowerCase() as ModelProvider) : null;
  }, [activeModelId]);

  const activeProviderInfo = React.useMemo(
    () => (activeProviderKey ? (MODEL_PROVIDER_BY_ID[activeProviderKey] ?? null) : null),
    [activeProviderKey]
  );

  const activeModelEntry = React.useMemo(() => {
    if (!activeModelId) {
      return null;
    }
    return models.find((m) => `${m.provider}/${m.id}` === activeModelId) ?? null;
  }, [models, activeModelId]);

  const activeModelTier = React.useMemo(
    () => (activeModelEntry ? getModelTier(activeModelEntry) : null),
    [activeModelEntry]
  );

  const activeModelMeta = React.useMemo(
    () => (activeModelEntry ? formatModelMeta(activeModelEntry) : null),
    [activeModelEntry]
  );

  // ── Actions ────────────────────────────────────────────────────

  const refreshKeyConfiguredProviders = React.useCallback(async () => {
    const api = getDesktopApiOrNull();
    if (!api?.authHasApiKey) {
      setKeyConfiguredProviders(null);
      return;
    }
    const results = await Promise.all(MODEL_PROVIDERS.map((p) => api.authHasApiKey(p.id)));
    const next = new Set<ModelProvider>();
    for (let i = 0; i < MODEL_PROVIDERS.length; i += 1) {
      const provider = MODEL_PROVIDERS[i]?.id;
      const configured = results[i]?.configured;
      if (provider && configured) {
        next.add(provider);
      }
    }
    setKeyConfiguredProviders(next);
  }, []);

  const loadModels = React.useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const result = await props.gw.request<{
        models?: Array<{
          id: string;
          name?: string;
          provider: string;
          contextWindow?: number;
          reasoning?: boolean;
        }>;
      }>("models.list", {});
      const entries: ModelEntry[] = (result.models ?? []).map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        provider: m.provider,
        contextWindow: m.contextWindow,
        reasoning: m.reasoning,
      }));
      setModels(entries);
    } catch (err) {
      setModelsError(String(err));
    } finally {
      setModelsLoading(false);
    }
  }, [props.gw]);

  React.useEffect(() => {
    void loadModels();
    void refreshKeyConfiguredProviders();
  }, [loadModels, refreshKeyConfiguredProviders]);

  const isProviderConfigured = React.useCallback(
    (id: ModelProvider): boolean => {
      const configEnabled = configuredProviders.has(id);
      const keyStored = keyConfiguredProviders ? keyConfiguredProviders.has(id) : null;
      return keyStored === null ? configEnabled : configEnabled && keyStored;
    },
    [configuredProviders, keyConfiguredProviders]
  );

  const pasteFromClipboard = React.useCallback(async (): Promise<string> => {
    try {
      const text = await navigator.clipboard.readText();
      return text?.trim() ?? "";
    } catch {
      return "";
    }
  }, []);

  const loadFreshBaseHash = React.useCallback(async (): Promise<string> => {
    const snap = await props.gw.request<{ hash?: string }>("config.get", {});
    const hash = typeof snap.hash === "string" ? snap.hash.trim() : "";
    if (!hash) {
      throw new Error("Missing config base hash. Click Reload and try again.");
    }
    return hash;
  }, [props.gw]);

  const saveProviderApiKey = React.useCallback(
    async (provider: ModelProvider, key: string) => {
      props.onError(null);
      setModelStatus(null);
      if (!key) {
        props.onError(`${provider} API key is required.`);
        return;
      }

      setBusyProvider(provider);
      try {
        const baseHash = await loadFreshBaseHash();
        await getDesktopApiOrNull()?.setApiKey(provider, key);
        const profileId = `${provider}:default`;
        await props.gw.request("config.patch", {
          baseHash,
          raw: JSON.stringify(
            {
              auth: {
                profiles: {
                  [profileId]: { provider, mode: "api_key" },
                },
                order: {
                  [provider]: [profileId],
                },
              },
            },
            null,
            2
          ),
          note: `Settings: enable ${provider} api_key profile`,
        });
        await props.reload();
        await refreshKeyConfiguredProviders();
        setModalProvider(null);
        setModelStatus("Key saved. Now pick a model below.");
      } catch (err) {
        props.onError(String(err));
      } finally {
        setBusyProvider(null);
      }
    },
    [props, loadFreshBaseHash, refreshKeyConfiguredProviders]
  );

  const clearSessionModelOverrides = React.useCallback(async () => {
    try {
      const listResult = await props.gw.request<{
        sessions?: Array<{ key: string; modelOverride?: string }>;
      }>("sessions.list", { includeGlobal: false, includeUnknown: false });
      const sessions = listResult.sessions ?? [];
      const withOverride = sessions.filter((s) => s.modelOverride);
      await Promise.all(
        withOverride.map((s) => props.gw.request("sessions.patch", { key: s.key, model: null }))
      );
    } catch {
      // Non-critical: if clearing overrides fails, the config default still
      // applies to new sessions; existing ones will catch up on /model reset.
    }
  }, [props.gw]);

  const saveDefaultModel = React.useCallback(
    async (modelId: string) => {
      props.onError(null);
      setModelsError(null);
      setModelStatus(null);
      setModelBusy(true);
      setModelStatus("Setting default model…");
      try {
        const baseHash = await loadFreshBaseHash();
        await props.gw.request("config.patch", {
          baseHash,
          raw: JSON.stringify(
            {
              agents: {
                defaults: {
                  model: {
                    primary: modelId,
                  },
                  models: {
                    [modelId]: {},
                  },
                },
              },
            },
            null,
            2
          ),
          note: "Settings: set default model",
        });
        await props.reload();
        await clearSessionModelOverrides();
        setModelStatus("Default model configured.");
      } catch (err) {
        props.onError(String(err));
        setModelStatus(null);
      } finally {
        setModelBusy(false);
      }
    },
    [props, loadFreshBaseHash, clearSessionModelOverrides]
  );

  const toggleProviderFilter = React.useCallback((id: ModelProvider) => {
    setProviderFilter((prev) => (prev === id ? null : id));
  }, []);

  return {
    // State
    busyProvider,
    modalProvider,
    setModalProvider,
    models,
    modelsLoading,
    modelsError,
    modelSearch,
    setModelSearch,
    modelBusy,
    modelStatus,
    providerFilter,

    // Derived
    activeModelId,
    strictConfiguredProviders,
    sortedModels,
    visibleProviders,
    modalProviderInfo,
    activeProviderKey,
    activeProviderInfo,
    activeModelEntry,
    activeModelTier,
    activeModelMeta,

    // Actions
    isProviderConfigured,
    pasteFromClipboard,
    saveProviderApiKey,
    saveDefaultModel,
    toggleProviderFilter,
  };
}
