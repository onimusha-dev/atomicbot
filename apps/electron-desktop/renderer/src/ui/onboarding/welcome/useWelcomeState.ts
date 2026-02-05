import React from "react";
import type { NavigateFunction } from "react-router-dom";
import { useGatewayRpc } from "../../../gateway/context";
import { useAppDispatch } from "../../../store/hooks";
import { setOnboarded } from "../../../store/slices/onboardingSlice";
import type { GatewayState } from "../../../../../src/main/types";
import { routes } from "../../routes";
import type { Provider } from "../ProviderSelectPage";
import { useWelcomeApiKey } from "./useWelcomeApiKey";
import { useWelcomeConfig } from "./useWelcomeConfig";
import { useWelcomeGog } from "./useWelcomeGog";
import { useWelcomeModels } from "./useWelcomeModels";
import { useWelcomeTelegram } from "./useWelcomeTelegram";

type WelcomeStateInput = {
  state: Extract<GatewayState, { kind: "ready" }>;
  navigate: NavigateFunction;
};

type SkillId = "google-workspace";
type SkillStatus = "connect" | "connected";

export function useWelcomeState({ state, navigate }: WelcomeStateInput) {
  const gw = useGatewayRpc();
  const dispatch = useAppDispatch();

  const [startBusy, setStartBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedProvider, setSelectedProvider] = React.useState<Provider | null>(null);
  const [apiKeyBusy, setApiKeyBusy] = React.useState(false);
  const [skills, setSkills] = React.useState<Record<SkillId, SkillStatus>>({
    "google-workspace": "connect",
  });

  const { configPath, ensureExtendedConfig, loadConfig } = useWelcomeConfig({
    gw,
    state,
    setError,
    setStatus,
  });
  const { saveApiKey } = useWelcomeApiKey({ gw, loadConfig, setError, setStatus });
  const { loadModels, models, modelsError, modelsLoading, saveDefaultModel } = useWelcomeModels({
    gw,
    loadConfig,
    setError,
    setStatus,
  });
  const {
    channelsProbe,
    saveTelegramAllowFrom,
    saveTelegramToken,
    setTelegramToken,
    setTelegramUserId,
    telegramToken,
    telegramUserId,
  } = useWelcomeTelegram({ gw, loadConfig, setError, setStatus });
  const { gogAccount, gogBusy, gogError, gogOutput, onGogAuthAdd, onGogAuthList, setGogAccount } = useWelcomeGog({
    gw,
  });

  const finish = React.useCallback(() => {
    void dispatch(setOnboarded(true));
    navigate(routes.chat, { replace: true });
  }, [dispatch, navigate]);

  const start = React.useCallback(async () => {
    setError(null);
    setStatus(null);
    setStartBusy(true);
    try {
      await ensureExtendedConfig();
      navigate(`${routes.welcome}/provider-select`);
    } catch (err) {
      setError(String(err));
    } finally {
      setStartBusy(false);
    }
  }, [ensureExtendedConfig, navigate]);

  const goApiKey = React.useCallback(() => navigate(`${routes.welcome}/api-key`), [navigate]);
  const goModelSelect = React.useCallback(() => navigate(`${routes.welcome}/model-select`), [navigate]);
  const goSkills = React.useCallback(() => navigate(`${routes.welcome}/skills`), [navigate]);
  const goTelegramToken = React.useCallback(() => navigate(`${routes.welcome}/telegram-token`), [navigate]);
  const goTelegramUser = React.useCallback(() => navigate(`${routes.welcome}/telegram-user`), [navigate]);
  const goGog = React.useCallback(() => navigate(`${routes.welcome}/gog`), [navigate]);
  const goGogGoogleWorkspace = React.useCallback(() => navigate(`${routes.welcome}/gog-google-workspace`), [navigate]);
  const goProviderSelect = React.useCallback(() => navigate(`${routes.welcome}/provider-select`), [navigate]);

  const markSkillConnected = React.useCallback((skillId: SkillId) => {
    setSkills((prev) => {
      if (prev[skillId] === "connected") {
        return prev;
      }
      return { ...prev, [skillId]: "connected" };
    });
  }, []);

  const onProviderSelect = React.useCallback(
    (provider: Provider) => {
      setSelectedProvider(provider);
      setError(null);
      setStatus(null);
      goApiKey();
    },
    [goApiKey],
  );

  const onApiKeySubmit = React.useCallback(
    async (apiKey: string) => {
      if (!selectedProvider) return;
      setApiKeyBusy(true);
      setError(null);
      try {
        const ok = await saveApiKey(selectedProvider, apiKey);
        if (ok) {
          // Load models after saving API key
          await loadModels();
          goModelSelect();
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setApiKeyBusy(false);
      }
    },
    [selectedProvider, saveApiKey, loadModels, goModelSelect],
  );

  const onModelSelect = React.useCallback(
    async (modelId: string) => {
      setError(null);
      try {
        await saveDefaultModel(modelId);
        goSkills();
      } catch (err) {
        setError(String(err));
      }
    },
    [saveDefaultModel, goSkills],
  );

  const onTelegramTokenNext = React.useCallback(async () => {
    setError(null);
    setStatus(null);
    try {
      const ok = await saveTelegramToken();
      if (ok) {
        goTelegramUser();
      }
    } catch (err) {
      setError(String(err));
      setStatus(null);
    }
  }, [goTelegramUser, saveTelegramToken]);

  const onTelegramUserNext = React.useCallback(async () => {
    setError(null);
    setStatus(null);
    try {
      const ok = await saveTelegramAllowFrom();
      if (ok) {
        goGog();
      }
    } catch (err) {
      setError(String(err));
      setStatus(null);
    }
  }, [goGog, saveTelegramAllowFrom]);

  return {
    apiKeyBusy,
    channelsProbe,
    configPath,
    error,
    finish,
    goApiKey,
    goGog,
    goGogGoogleWorkspace,
    goModelSelect,
    goProviderSelect,
    goSkills,
    goTelegramToken,
    goTelegramUser,
    gogAccount,
    gogBusy,
    gogError,
    gogOutput,
    loadModels,
    markSkillConnected,
    models,
    modelsError,
    modelsLoading,
    onApiKeySubmit,
    onGogAuthAdd,
    onGogAuthList,
    onModelSelect,
    onProviderSelect,
    onTelegramTokenNext,
    onTelegramUserNext,
    selectedProvider,
    setGogAccount,
    setTelegramToken,
    setTelegramUserId,
    skills,
    start,
    startBusy,
    status,
    telegramToken,
    telegramUserId,
  };
}
