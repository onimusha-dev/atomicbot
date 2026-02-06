import React from "react";
import { useNavigate } from "react-router-dom";
import { useGatewayRpc } from "../gateway/context";
import type { GatewayState } from "../../../src/main/types";
import { ActionButton, InlineError } from "./kit";
import { routes } from "./routes";

function newSessionKey(): string {
  return `agent:main:main:${crypto.randomUUID().slice(0, 8)}`;
}

export function StartChatPage({ state: _state }: { state: Extract<GatewayState, { kind: "ready" }> }) {
  const navigate = useNavigate();
  const gw = useGatewayRpc();
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const logoUrl = React.useMemo(() => {
    return new URL("../../assets/icon-simple-splash.png", document.baseURI).toString();
  }, []);

  const send = React.useCallback(async () => {
    const message = input.trim();
    if (!message || sending) return;

    const sessionKey = newSessionKey();
    const runId = crypto.randomUUID();
    setSending(true);
    setError(null);

    try {
      await gw.request("chat.send", {
        sessionKey,
        message,
        deliver: false,
        idempotencyKey: runId,
      });
      setInput("");
      const title = message.length > 48 ? `${message.slice(0, 48)}…` : message;
      navigate(`${routes.chat}?session=${encodeURIComponent(sessionKey)}`, {
        replace: true,
        state: {
          optimisticNewSession: { key: sessionKey, title },
          pendingFirstMessage: message,
        },
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setSending(false);
    }
  }, [gw.request, input, navigate, sending]);

  return (
    <div className="UiChatShell">
      {error && <InlineError>{error}</InlineError>}

      <div className="UiChatTranscript">
        <div className="UiChatEmpty">
          <div className="UiChatEmptyBubble">
            <img className="UiChatEmptyLogo" src={logoUrl} alt="" aria-hidden="true" />
          </div>
          <div className="UiChatEmptyTitle">What can I help with?</div>
          <div className="UiChatEmptySubtitle">Send a message to start a conversation</div>
        </div>
      </div>

      <div className="UiChatComposer">
        <div className="UiChatComposerInner">
          <textarea
            className="UiChatInput"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <ActionButton variant="primary" onClick={() => void send()} disabled={sending || !input.trim()}>
            {sending ? "Sending…" : "Send"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
