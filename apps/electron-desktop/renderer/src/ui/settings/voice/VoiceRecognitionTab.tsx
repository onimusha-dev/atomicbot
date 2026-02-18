import React from "react";
import { ActionButton, InlineError, TextInput } from "@shared/kit";
import { getObject } from "@shared/utils/configHelpers";
import { useWelcomeApiKey } from "@ui/onboarding/hooks/useWelcomeApiKey";
import type { ConfigSnapshot, GatewayRpcLike } from "@ui/onboarding/hooks/types";
import {
  getVoiceProvider,
  setVoiceProvider,
  type VoiceProvider,
} from "@ui/chat/hooks/useVoiceInput";
import s from "./VoiceRecognitionTab.module.css";
import ps from "../SettingsPage.module.css";

function detectOpenAiProvider(config: unknown): boolean {
  const cfg = getObject(config);
  const auth = getObject(cfg.auth);
  const profiles = getObject(auth.profiles);
  const order = getObject(auth.order);
  const hasProfile = Object.values(profiles).some((p) => {
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      return false;
    }
    return (p as { provider?: unknown }).provider === "openai";
  });
  const hasOrder = Object.prototype.hasOwnProperty.call(order, "openai");
  return Boolean(hasProfile || hasOrder);
}

export function VoiceRecognitionTab(props: {
  gw: { request: GatewayRpcLike["request"] };
  configSnap: ConfigSnapshot | null;
  reload: () => Promise<void>;
  onError: (value: string | null) => void;
}) {
  const [provider, setProvider] = React.useState<VoiceProvider>(getVoiceProvider);
  const [hasOpenAi, setHasOpenAi] = React.useState(false);
  const [openAiKey, setOpenAiKey] = React.useState("");
  const [keyBusy, setKeyBusy] = React.useState(false);
  const [keyError, setKeyError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const loadConfig = React.useCallback(async (): Promise<ConfigSnapshot> => {
    const snap = await props.gw.request<ConfigSnapshot>("config.get");
    return snap;
  }, [props.gw]);

  const { saveApiKey } = useWelcomeApiKey({
    gw: props.gw,
    loadConfig,
    setError: setKeyError,
    setStatus,
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await loadConfig();
        if (cancelled) return;
        setHasOpenAi(detectOpenAiProvider(snap.config));
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadConfig]);

  const handleSelectProvider = React.useCallback((p: VoiceProvider) => {
    setProvider(p);
    setSaved(false);
  }, []);

  const handleSave = React.useCallback(() => {
    setVoiceProvider(provider);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [provider]);

  const handleSaveKey = React.useCallback(async () => {
    setKeyBusy(true);
    setKeyError(null);
    try {
      const ok = await saveApiKey("openai", openAiKey);
      if (ok) {
        setOpenAiKey("");
        setHasOpenAi(true);
      }
    } catch (err) {
      setKeyError(String(err));
    } finally {
      setKeyBusy(false);
    }
  }, [openAiKey, saveApiKey]);

  const needsKey = provider === "openai" && !hasOpenAi;

  return (
    <div>
      <h2 className={ps.UiSettingsTabTitle}>Voice Recognition</h2>

      <div className={s.VoiceDescription}>
        Choose how voice input is transcribed in the chat. Hold the microphone button in the chat
        composer to dictate.
      </div>

      <div className={s.VoiceProviderSelect}>
        <button
          type="button"
          className={`${s.VoiceProviderOption}${provider === "openai" ? ` ${s["VoiceProviderOption--active"]}` : ""}`}
          onClick={() => handleSelectProvider("openai")}
        >
          <div className={s.VoiceProviderTitle}>OpenAI Whisper</div>
          <div className={s.VoiceProviderDesc}>
            Higher accuracy transcription via OpenAI API. Requires an API key.
          </div>
          {provider === "openai" && hasOpenAi && (
            <div className={s.VoiceProviderStatus}>API key configured</div>
          )}
        </button>

        <div className={`${s.VoiceProviderOption} ${s["VoiceProviderOption--disabled"]}`}>
          <div className={s.VoiceProviderTitle}>
            Local Whisper
            <span className={s.VoiceProviderBadge}>Coming soon</span>
          </div>
          <div className={s.VoiceProviderDesc}>
            On-device transcription using a local Whisper model. Free, private, no API key needed.
          </div>
        </div>
      </div>

      {needsKey && (
        <div className={s.VoiceKeySection}>
          <InlineError>
            OpenAI is not configured. Add an API key to use Whisper transcription.
          </InlineError>
          {keyError && <InlineError>{keyError}</InlineError>}
          <label className={s.VoiceKeyLabel}>OpenAI API key</label>
          <TextInput
            type="password"
            value={openAiKey}
            onChange={setOpenAiKey}
            placeholder="sk-..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={keyBusy}
          />
          <div className={s.VoiceKeyActions}>
            <ActionButton
              disabled={keyBusy || !openAiKey.trim()}
              onClick={() => void handleSaveKey()}
            >
              {keyBusy ? "Saving..." : "Save key"}
            </ActionButton>
          </div>
        </div>
      )}

      {status && <div className={s.VoiceStatus}>{status}</div>}

      <div className={s.VoiceSaveRow}>
        <ActionButton variant="primary" disabled={needsKey} onClick={handleSave}>
          {saved ? "Saved!" : "Save"}
        </ActionButton>
      </div>
    </div>
  );
}
