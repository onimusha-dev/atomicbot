import React from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import type {
  UiMessageAttachment,
  UiToolCall,
  UiToolResult,
  LiveToolCall,
} from "@store/slices/chatSlice";
import { isHeartbeatMessage } from "@store/slices/chatSlice";
import type { ChatAttachmentInput } from "@store/slices/chatSlice";
import { CopyMessageButton } from "./CopyMessageButton";
import { UserMessageBubble } from "./UserMessageBubble";
import { AssistantStreamBubble, TypingIndicator } from "./AssistantStreamBubble";
import { ToolCallCards, LiveToolCallCards, HIDDEN_TOOL_NAMES } from "./ToolCallCard";
import { ActionLog } from "./ActionLog";
import am from "./AssistantMessage.module.css";
import ct from "../ChatTranscript.module.css";

type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  attachments?: UiMessageAttachment[];
  toolCalls?: UiToolCall[];
  toolResults?: UiToolResult[];
};

type StreamEntry = {
  id: string;
  role: string;
  text: string;
};

export function ChatMessageList(props: {
  displayMessages: DisplayMessage[];
  streamByRun: Record<string, StreamEntry>;
  liveToolCalls: LiveToolCall[];
  optimisticFirstMessage: string | null;
  optimisticFirstAttachments: ChatAttachmentInput[] | null;
  matchingFirstUserFromHistory: DisplayMessage | null;
  waitingForFirstResponse: boolean;
  markdownComponents: Components;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const {
    displayMessages,
    streamByRun,
    liveToolCalls,
    optimisticFirstMessage,
    optimisticFirstAttachments,
    matchingFirstUserFromHistory,
    waitingForFirstResponse,
    markdownComponents,
    scrollRef,
  } = props;

  /** Stable key for the first user message so React doesn't remount when switching from optimistic to history. */
  const getMessageKey = (m: DisplayMessage) =>
    (optimisticFirstMessage != null && m.id === "opt-first") ||
    (matchingFirstUserFromHistory != null && m.id === matchingFirstUserFromHistory.id)
      ? "first-user"
      : m.id;

  // Group consecutive tool-call-only assistant messages into single blocks.
  type RenderItem =
    | { kind: "user"; msg: DisplayMessage }
    | { kind: "assistant"; msg: DisplayMessage }
    | { kind: "tool-group"; msgs: DisplayMessage[] };

  const renderItems: RenderItem[] = [];
  for (const m of displayMessages) {
    if (m.role === "user") {
      renderItems.push({ kind: "user", msg: m });
      continue;
    }
    const isToolOnly = !m.text && m.toolCalls && m.toolCalls.length > 0;
    if (isToolOnly) {
      const prev = renderItems[renderItems.length - 1];
      if (prev?.kind === "tool-group") {
        prev.msgs.push(m);
      } else {
        renderItems.push({ kind: "tool-group", msgs: [m] });
      }
    } else {
      renderItems.push({ kind: "assistant", msg: m });
    }
  }

  const streamBubbles = Object.values(streamByRun).filter(
    (m) => !isHeartbeatMessage(m.role, m.text)
  );
  const hasStreamBubbles = streamBubbles.length > 0;
  const lastAssistantRenderIndex =
    renderItems.length > 0
      ? [...renderItems]
          .reverse()
          .findIndex((i) => i.kind === "assistant" || i.kind === "tool-group")
      : -1;
  const lastAssistantFromRenderItems =
    lastAssistantRenderIndex >= 0 ? renderItems.length - 1 - lastAssistantRenderIndex : -1;

  return (
    <div className={ct.UiChatTranscript + " scrollable"} ref={scrollRef}>
      <div className={ct.UiChatTranscriptInner}>
        {renderItems.map((item, index) => {
          if (item.kind === "user") {
            const m = item.msg;
            const attachmentsToShow: UiMessageAttachment[] =
              m.id === "opt-first" && optimisticFirstAttachments?.length
                ? optimisticFirstAttachments.map((att) => ({
                    type: att.mimeType?.startsWith("image/") ? "image" : "file",
                    mimeType: att.mimeType,
                    dataUrl: att.dataUrl,
                  }))
                : (m.attachments ?? []);
            return (
              <UserMessageBubble
                key={getMessageKey(m)}
                id={m.id}
                text={m.text}
                pending={m.pending}
                attachments={attachmentsToShow}
                markdownComponents={markdownComponents}
              />
            );
          }

          if (item.kind === "tool-group") {
            const key = item.msgs.map((m) => getMessageKey(m)).join("+");
            const isLastAssistant =
              !hasStreamBubbles &&
              liveToolCalls.length === 0 &&
              !waitingForFirstResponse &&
              index === lastAssistantFromRenderItems;
            const resultMap = new Map<string, UiToolResult>();
            for (const m of item.msgs) {
              for (const r of m.toolResults ?? []) {
                if (r.toolCallId) resultMap.set(r.toolCallId, r);
              }
            }
            const flatCards: { toolCall: UiToolCall; result?: UiToolResult }[] = [];
            for (const m of item.msgs) {
              const list = (m.toolCalls ?? []).filter((tc) => !HIDDEN_TOOL_NAMES.has(tc.name));
              for (const tc of list) {
                flatCards.push({ toolCall: tc, result: resultMap.get(tc.id) });
              }
            }
            return (
              <div
                key={key}
                className={`${ct.UiChatRow} ${am["UiChatRow-assistant"]} ${isLastAssistant ? ct.UiChatRowLastAssistant : ""}`}
              >
                <div className={am["UiChatBubble-assistant"]}>
                  <ActionLog cards={flatCards} />
                </div>
              </div>
            );
          }

          // Assistant message with text (may also have tool calls)
          const m = item.msg;
          const isLastAssistant =
            !hasStreamBubbles &&
            liveToolCalls.length === 0 &&
            !waitingForFirstResponse &&
            index === lastAssistantFromRenderItems;
          return (
            <div
              key={getMessageKey(m)}
              className={`${ct.UiChatRow} ${am["UiChatRow-assistant"]} ${isLastAssistant ? ct.UiChatRowLastAssistant : ""}`}
            >
              <div className={am["UiChatBubble-assistant"]}>
                {m.toolCalls?.length ? (
                  <ToolCallCards toolCalls={m.toolCalls} toolResults={m.toolResults} />
                ) : null}
                {m.text ? (
                  <div className="UiChatText UiMarkdown">
                    <Markdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {m.text}
                    </Markdown>
                  </div>
                ) : null}
                {m.text ? (
                  <div className={am.UiChatMessageActions}>
                    <CopyMessageButton text={m.text} />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {waitingForFirstResponse ? (
          <TypingIndicator
            classNameRoot={
              !hasStreamBubbles && liveToolCalls.length === 0
                ? ct.UiChatRowLastAssistant
                : undefined
            }
          />
        ) : null}

        {liveToolCalls.length > 0 ? (
          <div
            className={`${ct.UiChatRow} ${am["UiChatRow-assistant"]} ${!hasStreamBubbles ? ct.UiChatRowLastAssistant : ""}`}
          >
            <div className={am["UiChatBubble-assistant"]}>
              <LiveToolCallCards toolCalls={liveToolCalls} />
            </div>
          </div>
        ) : null}

        {streamBubbles.map((m, i) => (
          <AssistantStreamBubble
            key={m.id}
            id={m.id}
            text={m.text}
            markdownComponents={markdownComponents}
            classNameRoot={i === streamBubbles.length - 1 ? ct.UiChatRowLastAssistant : undefined}
          />
        ))}
      </div>
    </div>
  );
}
