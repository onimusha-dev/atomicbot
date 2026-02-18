import React from "react";
import type { Components } from "react-markdown";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getDesktopApiOrNull } from "@ipc/desktopApi";
import { getObject } from "@shared/utils/configHelpers";
import { useGatewayRpc } from "@gateway/context";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import {
  chatActions,
  isHeartbeatMessage,
  isApprovalContinueMessage,
  loadChatHistory,
  sendChatMessage,
  type ChatAttachmentInput,
} from "@store/slices/chatSlice";
import type { GatewayState } from "@main/types";
import { CopyIcon, CheckIcon } from "@shared/kit/icons";
import { HIDDEN_TOOL_NAMES } from "./components/ToolCallCard";
import { ChatComposer, type ChatComposerRef } from "./components/ChatComposer";
import { ChatMessageList } from "./components/ChatMessageList";
import { ScrollToBottomButton } from "./components/ScrollToBottomButton";
import { useOptimisticSession } from "./hooks/optimisticSessionContext";
import { useChatStream } from "./hooks/useChatStream";
import { useVoiceInput } from "./hooks/useVoiceInput";
import { addToastError } from "@shared/toast";
import ct from "./ChatTranscript.module.css";

/** Extract plain text from React children tree (for copying code content). */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (typeof node === "object" && "props" in node) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(el.props.children);
  }
  return "";
}

/** Copy-to-clipboard button rendered inside code block header. */
function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      className="UiMarkdownCopyCodeBtn"
      onClick={() => {
        void navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ChatPage({ state: _state }: { state: Extract<GatewayState, { kind: "ready" }> }) {
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get("session") ?? "";
  const [input, setInput] = React.useState("");
  const [attachments, setAttachments] = React.useState<ChatAttachmentInput[]>([]);
  const { optimistic, setOptimistic } = useOptimisticSession();
  /** Optimistic first message only for current thread (sessionKey matches). */
  const optimisticFirstMessage =
    optimistic?.key === sessionKey ? (optimistic.firstMessage ?? null) : null;
  const optimisticFirstAttachments =
    optimistic?.key === sessionKey ? (optimistic.firstAttachments ?? null) : null;

  const dispatch = useAppDispatch();
  const rawMessages = useAppSelector((s) => s.chat.messages);
  const activeSessionKey = useAppSelector((s) => s.chat.activeSessionKey);
  // Prevent rendering stale messages from a previous session during the single
  // render between navigation (sessionKey changes immediately) and the
  // sessionCleared effect (runs after the render).
  const messages = activeSessionKey === sessionKey ? rawMessages : [];
  const rawStreamByRun = useAppSelector((s) => s.chat.streamByRun);
  const streamByRun = activeSessionKey === sessionKey ? rawStreamByRun : {};
  const rawLiveToolCalls = useAppSelector((s) => s.chat.liveToolCalls);
  const liveToolCalls = activeSessionKey === sessionKey ? Object.values(rawLiveToolCalls) : [];
  const sending = useAppSelector((s) => s.chat.sending);
  const awaitingContinuation = useAppSelector((s) => s.chat.awaitingContinuation);
  const error = useAppSelector((s) => s.chat.error);

  const gw = useGatewayRpc();
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const composerRef = React.useRef<ChatComposerRef | null>(null);

  const scrollToBottom = React.useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  /** Override markdown components: links open in system browser, code blocks get a copy button. */
  const markdownComponents: Components = React.useMemo(
    () => ({
      a: ({ href, children, ...rest }) => (
        <a
          {...rest}
          href={href}
          onClick={(e) => {
            e.preventDefault();
            if (href) {
              getDesktopApiOrNull()?.openExternal(href);
            }
          }}
        >
          {children}
        </a>
      ),
      pre: ({ children, ...rest }) => {
        let lang = "";
        const child = React.Children.toArray(children)[0];
        if (React.isValidElement(child) && child.props) {
          const className = (child.props as Record<string, unknown>).className;
          if (typeof className === "string") {
            const match = className.match(/language-(\S+)/);
            if (match) {
              lang = match[1];
            }
          }
        }
        const code = extractText(children).replace(/\n$/, "");
        return (
          <div className="UiMarkdownCodeBlock">
            {lang ? <span className="UiMarkdownCodeBlockLang">{lang}</span> : null}
            <CopyCodeButton code={code} />
            <pre {...rest}>{children}</pre>
          </div>
        );
      },
    }),
    []
  );

  /** First user message in history that matches optimistic text; used for seamless handoff. */
  const matchingFirstUserFromHistory = React.useMemo(() => {
    if (optimisticFirstMessage === null) {
      return null;
    }
    const userMsg = messages.find(
      (m) => m.role === "user" && m.text.startsWith(optimisticFirstMessage)
    );
    return userMsg ?? null;
  }, [messages, optimisticFirstMessage]);

  // Clear optimistic session once history has loaded user messages for this
  // thread.  Using the presence of any user message (rather than strict text
  // matching) avoids stale optimistic state when the gateway stores the text
  // in a slightly different form.
  const hasUserFromHistory = messages.some((m) => m.role === "user");
  React.useEffect(() => {
    if (optimistic?.key === sessionKey && hasUserFromHistory) {
      setOptimistic(null);
    }
  }, [optimistic?.key, sessionKey, hasUserFromHistory, setOptimistic]);

  // Subscribe to gateway chat stream events (hook expects payload required; context type has payload optional).
  useChatStream(gw as Parameters<typeof useChatStream>[0], dispatch, sessionKey);

  const refresh = React.useCallback(() => {
    void dispatch(loadChatHistory({ request: gw.request, sessionKey, limit: 200 }));
  }, [dispatch, gw.request, sessionKey]);

  // Clear transcript and reload history atomically when the session changes or
  // the component remounts (e.g. navigating back from settings).
  React.useEffect(() => {
    dispatch(chatActions.sessionCleared(sessionKey));
    refresh();
  }, [sessionKey, dispatch, refresh]);

  // Focus input when opening chat page or switching between chats.
  React.useEffect(() => {
    const id = requestAnimationFrame(() => composerRef.current?.focusInput());
    return () => cancelAnimationFrame(id);
  }, [sessionKey]);

  // Derived list and waiting state.
  const allMessages =
    matchingFirstUserFromHistory != null
      ? messages
      : optimisticFirstMessage != null && !hasUserFromHistory
        ? [{ id: "opt-first", role: "user" as const, text: optimisticFirstMessage }, ...messages]
        : messages;
  const displayMessages = allMessages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      (m.text.trim() !== "" ||
        (m.toolCalls && m.toolCalls.some((tc) => !HIDDEN_TOOL_NAMES.has(tc.name)))) &&
      !isHeartbeatMessage(m.role, m.text) &&
      !isApprovalContinueMessage(m.role, m.text)
  );

  const hasActiveStream = Object.keys(streamByRun).length > 0 || liveToolCalls.length > 0;
  const waitingForFirstResponse =
    (displayMessages.some((m) => m.role === "user") &&
      !displayMessages.some((m) => m.role === "assistant") &&
      !hasActiveStream) ||
    (awaitingContinuation && !hasActiveStream);

  // Scroll to bottom: on initial load or when user sent.
  const prevDisplayCountRef = React.useRef(0);
  const prevMessagesLengthRef = React.useRef(messages.length);
  const lastMessageRole = messages[messages.length - 1]?.role;

  React.useEffect(() => {
    const loaded = displayMessages.length > 0 && prevDisplayCountRef.current === 0;
    prevDisplayCountRef.current = displayMessages.length;

    const userJustSent =
      messages.length === prevMessagesLengthRef.current + 1 && lastMessageRole === "user";
    prevMessagesLengthRef.current = messages.length;

    if (loaded || userJustSent) {
      const id = requestAnimationFrame(() => scrollToBottom());
      return () => cancelAnimationFrame(id);
    }
  }, [displayMessages.length, messages.length, lastMessageRole, scrollToBottom]);

  React.useEffect(() => {
    if (error) {
      addToastError(error);
      dispatch(chatActions.setError(null));
    }
  }, [error, dispatch]);

  const navigate = useNavigate();
  const voice = useVoiceInput(gw.request);

  const [voiceConfigured, setVoiceConfigured] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await gw.request<{ config: unknown }>("config.get");
        if (cancelled) return;
        const cfg = getObject(snap.config);
        const auth = getObject(cfg.auth);
        const profiles = getObject(auth.profiles);
        const order = getObject(auth.order);
        const hasProfile = Object.values(profiles).some((p) => {
          if (!p || typeof p !== "object" || Array.isArray(p)) return false;
          return (p as { provider?: unknown }).provider === "openai";
        });
        const hasOrder = Object.prototype.hasOwnProperty.call(order, "openai");
        setVoiceConfigured(Boolean(hasProfile || hasOrder));
      } catch {
        setVoiceConfigured(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gw.request]);

  React.useEffect(() => {
    if (voice.error) {
      addToastError(voice.error);
    }
  }, [voice.error]);

  const handleVoiceStart = React.useCallback(() => {
    voice.startRecording();
  }, [voice]);

  const handleVoiceStop = React.useCallback(async () => {
    const text = await voice.stopRecording();
    if (text) {
      setInput((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${text}` : text;
      });
    }
    requestAnimationFrame(() => composerRef.current?.focusInput());
  }, [voice]);

  const handleNavigateVoiceSettings = React.useCallback(() => {
    navigate("/settings/voice");
  }, [navigate]);

  const send = React.useCallback(() => {
    const message = input.trim();
    const hasAttachments = attachments.length > 0;
    if (!message && !hasAttachments) {
      return;
    }
    const toSend = attachments.length > 0 ? [...attachments] : undefined;
    setInput("");
    setAttachments([]);
    void dispatch(
      sendChatMessage({ request: gw.request, sessionKey, message, attachments: toSend })
    );
  }, [dispatch, gw.request, input, sessionKey, attachments]);

  return (
    <div className={ct.UiChatShell}>
      <ChatMessageList
        displayMessages={
          displayMessages as React.ComponentProps<typeof ChatMessageList>["displayMessages"]
        }
        streamByRun={streamByRun}
        liveToolCalls={liveToolCalls}
        optimisticFirstMessage={optimisticFirstMessage}
        optimisticFirstAttachments={optimisticFirstAttachments}
        matchingFirstUserFromHistory={
          matchingFirstUserFromHistory as React.ComponentProps<
            typeof ChatMessageList
          >["matchingFirstUserFromHistory"]
        }
        waitingForFirstResponse={waitingForFirstResponse}
        markdownComponents={markdownComponents}
        scrollRef={scrollRef}
      />

      <div className={ct.UiChatScrollToBottomWrap}>
        <ScrollToBottomButton
          scrollRef={scrollRef}
          onScroll={scrollToBottom}
          contentKey={displayMessages.length}
        />

        <ChatComposer
          ref={composerRef}
          value={input}
          onChange={setInput}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onSend={send}
          disabled={sending}
          onAttachmentsLimitError={(msg) => addToastError(msg)}
          isVoiceRecording={voice.isRecording}
          isVoiceProcessing={voice.isProcessing}
          onVoiceStart={handleVoiceStart}
          onVoiceStop={handleVoiceStop}
          voiceNotConfigured={voiceConfigured === false}
          onNavigateVoiceSettings={handleNavigateVoiceSettings}
        />
      </div>
    </div>
  );
}
