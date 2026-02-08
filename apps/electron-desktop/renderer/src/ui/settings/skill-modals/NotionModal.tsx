import React from "react";

import { ActionButton, InlineError, TextInput } from "../../kit";
import { useWelcomeNotion } from "../../onboarding/welcome/useWelcomeNotion";
import type { ConfigSnapshot, GatewayRpcLike } from "../../onboarding/welcome/types";

function getObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function NotionModalContent(props: {
  gw: GatewayRpcLike;
  loadConfig: () => Promise<ConfigSnapshot>;
  isConnected: boolean;
  onConnected: () => void;
  onDisabled: () => void;
}) {
  const [apiKey, setApiKey] = React.useState("");
  const [hasExistingKey, setHasExistingKey] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const { saveNotionApiKey } = useWelcomeNotion({
    gw: props.gw,
    loadConfig: props.loadConfig,
    setError,
    setStatus,
  });

  // Pre-fill: detect if API key is already configured.
  React.useEffect(() => {
    if (!props.isConnected) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await props.loadConfig();
        if (cancelled) return;
        const cfg = getObject(snap.config);
        const skills = getObject(cfg.skills);
        const entries = getObject(skills.entries);
        const notion = getObject(entries.notion);
        if (typeof notion.apiKey === "string" && notion.apiKey.trim()) {
          setHasExistingKey(true);
        }
      } catch {
        // Best-effort.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.isConnected, props.loadConfig]);

  const handleConnect = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const ok = await saveNotionApiKey(apiKey);
      if (ok) {
        props.onConnected();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [apiKey, props, saveNotionApiKey]);

  return (
    <div className="UiSkillModalContent">
      <div className="UiSectionSubtitle">
        Create, search, update and organize your notes, docs, and knowledge base. Enter your Notion
        Integration API key below.
      </div>
      {error && <InlineError>{error}</InlineError>}
      {status && <div className="UiSkillModalStatus">{status}</div>}
      {hasExistingKey && !apiKey && (
        <div className="UiSkillModalStatus">API key configured. Enter a new key to update.</div>
      )}

      <div className="UiSkillModalField">
        <label className="UiSkillModalLabel">Notion API key</label>
        <TextInput
          type="password"
          value={apiKey}
          onChange={setApiKey}
          placeholder={hasExistingKey ? "••••••••  (leave empty to keep current)" : "ntn_..."}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <div className="UiSkillModalActions">
        <ActionButton
          variant="primary"
          disabled={busy || (!apiKey.trim() && !props.isConnected)}
          onClick={() => void handleConnect()}
        >
          {busy ? "Connecting…" : props.isConnected ? "Update" : "Connect"}
        </ActionButton>
      </div>

      {(props.isConnected || hasExistingKey) && (
        <div className="UiSkillModalDangerZone">
          <button
            type="button"
            className="UiSkillModalDisableButton"
            disabled={busy}
            onClick={props.onDisabled}
          >
            Disable
          </button>
        </div>
      )}
    </div>
  );
}
