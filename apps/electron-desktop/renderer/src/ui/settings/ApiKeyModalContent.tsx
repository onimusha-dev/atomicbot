/**
 * Modal content for entering/validating an API key for a model provider.
 * Extracted from ModelProvidersTab.tsx.
 */
import React from "react";

import { getDesktopApiOrNull } from "../../ipc/desktopApi";
import { ActionButton, TextInput } from "../shared/kit";
import type { ModelProviderInfo } from "../shared/models/providers";
import { resolveProviderIconUrl } from "../shared/models/providers";

export function ApiKeyModalContent(props: {
  provider: ModelProviderInfo;
  busy: boolean;
  onSave: (key: string) => void;
  onPaste: () => Promise<string>;
  onClose: () => void;
}) {
  const { provider, busy } = props;
  const [draftKey, setDraftKey] = React.useState("");
  const [validating, setValidating] = React.useState(false);
  const [validationError, setValidationError] = React.useState("");

  const handlePaste = React.useCallback(async () => {
    const text = await props.onPaste();
    if (text) {
      setDraftKey(text);
      setValidationError("");
    }
  }, [props]);

  const handleSave = React.useCallback(async () => {
    const trimmed = draftKey.trim();
    if (!trimmed) {return;}

    setValidationError("");
    setValidating(true);
    try {
      const result = await getDesktopApiOrNull()?.validateApiKey(provider.id, trimmed);
      if (result && !result.valid) {
        setValidationError(result.error ?? "Invalid API key.");
        return;
      }
    } catch {
      // If validation IPC is unavailable, allow saving anyway
    } finally {
      setValidating(false);
    }

    props.onSave(trimmed);
  }, [draftKey, provider.id, props]);

  const isBusy = busy || validating;

  return (
    <>
      <div className="UiModalProviderHeader">
        <span className="UiModalProviderIcon" aria-hidden="true">
          <img src={resolveProviderIconUrl(provider.id)} alt="" />
        </span>
        <span className="UiModalProviderName">{provider.name}</span>
      </div>

      <div className="UiModalHelpText">
        {provider.helpText}{" "}
        {provider.helpUrl ? (
          <a
            href={provider.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="UiLink"
            onClick={(e) => {
              e.preventDefault();
              if (!provider.helpUrl) {return;}
              void getDesktopApiOrNull()?.openExternal(provider.helpUrl);
            }}
          >
            Get API key ↗
          </a>
        ) : null}
      </div>

      <div className="UiModalInputRow">
        <TextInput
          type="password"
          value={draftKey}
          onChange={(v) => {
            setDraftKey(v);
            if (validationError) {setValidationError("");}
          }}
          placeholder={provider.placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={isBusy}
          isError={validationError}
        />
      </div>

      <div className="UiModalActions">
        <ActionButton disabled={isBusy} onClick={() => void handlePaste()}>
          Paste
        </ActionButton>
        <ActionButton
          variant="primary"
          disabled={isBusy || !draftKey.trim()}
          loading={validating}
          onClick={() => void handleSave()}
        >
          {validating ? "Validating…" : busy ? "Saving…" : "Save"}
        </ActionButton>
      </div>
    </>
  );
}
