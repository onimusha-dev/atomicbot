import React from "react";
import Markdown, { type Components } from "react-markdown";

import type { UiMessageAttachment, UiToolCall, UiToolResult, LiveToolCall } from "@store/slices/chatSlice";
import { isHeartbeatMessage } from "@store/slices/chatSlice";
import type { ChatAttachmentInput } from "@store/slices/chatSlice";
import { CopyMessageButton } from "./CopyMessageButton";
import { UserMessageBubble } from "./UserMessageBubble";
import { AssistantStreamBubble, TypingIndicator } from "./AssistantStreamBubble";
import { ToolCallCards, LiveToolCallCards } from "./ToolCallCard";
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

  return (
    <div className={ct.UiChatTranscript} ref={scrollRef}>
      {displayMessages.map((m) => {
        const attachmentsToShow: UiMessageAttachment[] =
          m.id === "opt-first" && optimisticFirstAttachments?.length
            ? optimisticFirstAttachments.map((att) => ({
                type: att.mimeType?.startsWith("image/") ? "image" : "file",
                mimeType: att.mimeType,
                dataUrl: att.dataUrl,
              }))
            : (m.attachments ?? []);

        if (m.role === "user") {
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

        // Assistant message from history
        return (
          <div key={getMessageKey(m)} className={`${ct.UiChatRow} ${am["UiChatRow-assistant"]}`}>
            <div className={am["UiChatBubble-assistant"]}>
              {m.toolCalls?.length ? (
                <ToolCallCards toolCalls={m.toolCalls} toolResults={m.toolResults} />
              ) : null}
              {m.text ? (
                <div className="UiChatText UiMarkdown">
                  <Markdown components={markdownComponents}>{m.text}</Markdown>
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

      {waitingForFirstResponse ? <TypingIndicator /> : null}

      {liveToolCalls.length > 0 ? (
        <div className={`${ct.UiChatRow} ${am["UiChatRow-assistant"]}`}>
          <div className={am["UiChatBubble-assistant"]}>
            <LiveToolCallCards toolCalls={liveToolCalls} />
          </div>
        </div>
      ) : null}

      {Object.values(streamByRun)
        .filter((m) => !isHeartbeatMessage(m.role, m.text))
        .map((m) => (
          <AssistantStreamBubble
            key={m.id}
            id={m.id}
            text={m.text}
            markdownComponents={markdownComponents}
          />
        ))}
    </div>
  );
}
