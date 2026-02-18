import React from "react";
import type { UiToolCall, UiToolResult } from "@store/slices/chatSlice";
import { ToolCallCard } from "./ToolCallCard";
import al from "./ActionLog.module.css";

export type ActionLogCard = { toolCall: UiToolCall; result?: UiToolResult };

export function ActionLog({ cards }: { cards: ActionLogCard[] }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className={al.ActionLog}>
      <button
        type="button"
        className={al.ActionLogHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span>Action Log</span>
        <svg
          className={`${al.ActionLogChevron} ${expanded ? al.ActionLogChevronOpen : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {expanded ? (
        <div className={al.ActionLogBody}>
          <div className={al.ActionLogList}>
            {cards.map(({ toolCall, result }) => (
              <div key={toolCall.id} className={al.ActionLogItem}>
                <div className={al.ActionLogDotWrap}>
                  <span className={al.ActionLogDot} />
                </div>
                <div className={al.ActionLogCard}>
                  <ToolCallCard toolCall={toolCall} result={result} alwaysExpanded />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
