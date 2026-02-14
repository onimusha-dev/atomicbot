import React from "react";
import Markdown, { type Components } from "react-markdown";

import am from "./AssistantMessage.module.css";
import ct from "../ChatTranscript.module.css";

/** Typing-dots indicator (used while waiting for the first response). */
export function TypingIndicator() {
  return (
    <div className={`${ct.UiChatRow} ${am["UiChatRow-assistant"]}`}>
      <div className={`${am["UiChatBubble-assistant"]} ${am["UiChatBubble-stream"]}`}>
        <div className="UiChatBubbleMeta">
          <span className="UiChatPending">
            <span className={am.UiChatTypingDots} aria-label="typing">
              <span />
              <span />
              <span />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** A streaming assistant message bubble (with typing dots + partial text). */
export function AssistantStreamBubble(props: {
  id: string;
  text: string;
  markdownComponents: Components;
}) {
  return (
    <div className={`${ct.UiChatRow} ${am["UiChatRow-assistant"]}`}>
      <div className={`${am["UiChatBubble-assistant"]} ${am["UiChatBubble-stream"]}`}>
        <div className="UiChatBubbleMeta">
          <span className="UiChatPending">
            <span className={am.UiChatTypingDots} aria-label="typing">
              <span />
              <span />
              <span />
            </span>
          </span>
        </div>
        {props.text ? (
          <div className="UiChatText UiMarkdown">
            <Markdown components={props.markdownComponents}>{props.text}</Markdown>
          </div>
        ) : null}
      </div>
    </div>
  );
}
