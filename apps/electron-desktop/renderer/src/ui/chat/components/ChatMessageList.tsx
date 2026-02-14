import React from "react";
import Markdown, { type Components } from "react-markdown";

import type { UiMessageAttachment } from "@store/slices/chatSlice";
import { isHeartbeatMessage } from "@store/slices/chatSlice";
import type { ChatAttachmentInput } from "@store/slices/chatSlice";
import { CopyMessageButton } from "./CopyMessageButton";
import { UserMessageBubble } from "./UserMessageBubble";
import { AssistantStreamBubble, TypingIndicator } from "./AssistantStreamBubble";
import am from "./AssistantMessage.module.css";
import ct from "../ChatTranscript.module.css";

type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  attachments?: UiMessageAttachment[];
};

type StreamEntry = {
  id: string;
  role: string;
  text: string;
};

export function ChatMessageList(props: {
  displayMessages: DisplayMessage[];
  streamByRun: Record<string, StreamEntry>;
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
              <div className="UiChatText UiMarkdown">
                <Markdown components={markdownComponents}>{m.text}</Markdown>
              </div>
              <div className={am.UiChatMessageActions}>
                <CopyMessageButton text={m.text} />
              </div>
            </div>
          </div>
        );
      })}

      {waitingForFirstResponse ? <TypingIndicator /> : null}

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
