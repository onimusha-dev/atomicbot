import React from "react";
import type { UiToolCall, UiToolResult, LiveToolCall } from "@store/slices/chatSlice";
import s from "./ToolCallCard.module.css";

/** Human-readable labels for known tool names. */
const TOOL_LABELS: Record<string, string> = {
  exec: "Run command",
  read: "Read file",
  write: "Write file",
  search: "Search",
  browser: "Browser",
};

/** Format tool arguments into a short one-liner for display. */
function formatArgs(args: Record<string, unknown>): string {
  if ("command" in args && typeof args.command === "string") {
    return args.command;
  }
  if ("path" in args && typeof args.path === "string") {
    return args.path;
  }
  if ("query" in args && typeof args.query === "string") {
    return args.query;
  }
  const keys = Object.keys(args);
  if (keys.length === 0) {return "";}
  // Fall back to first string value
  for (const k of keys) {
    if (typeof args[k] === "string") {return `${k}: ${args[k]}`;}
  }
  return keys.join(", ");
}

/** Small icon for the tool card header. */
function ToolIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

/** Render a single tool call as a compact card. */
export function ToolCallCard({
  toolCall,
  result,
}: {
  toolCall: UiToolCall;
  result?: UiToolResult;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const argsSummary = formatArgs(toolCall.arguments);
  const hasResult = Boolean(result?.text);

  return (
    <div className={s.ToolCallCard}>
      <button
        type="button"
        className={s.ToolCallHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={s.ToolCallIcon}>
          <ToolIcon />
        </span>
        <span className={s.ToolCallLabel}>{label}</span>
        {argsSummary ? (
          <span className={s.ToolCallArgs}>{argsSummary}</span>
        ) : null}
        {result?.status ? (
          <span
            className={`${s.ToolCallStatus} ${
              result.status === "approval-pending" ? s["ToolCallStatus--pending"] : ""
            }`}
          >
            {result.status === "approval-pending" ? "pending" : result.status}
          </span>
        ) : null}
        <span className={`${s.ToolCallChevron} ${expanded ? s["ToolCallChevron--open"] : ""}`}>
          ▸
        </span>
      </button>
      {expanded && hasResult ? (
        <pre className={s.ToolCallOutput}>{result!.text}</pre>
      ) : null}
    </div>
  );
}

/** Render a list of tool calls (and optionally their results). */
export function ToolCallCards({
  toolCalls,
  toolResults,
}: {
  toolCalls: UiToolCall[];
  toolResults?: UiToolResult[];
}) {
  if (!toolCalls.length) {return null;}
  const resultMap = new Map<string, UiToolResult>();
  for (const r of toolResults ?? []) {
    if (r.toolCallId) {resultMap.set(r.toolCallId, r);}
  }
  return (
    <div className={s.ToolCallCards}>
      {toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} result={resultMap.get(tc.id)} />
      ))}
    </div>
  );
}

/** Render a single live tool call card (real-time via agent events). */
function LiveToolCallCardItem({ tc }: { tc: LiveToolCall }) {
  const [expanded, setExpanded] = React.useState(false);
  const label = TOOL_LABELS[tc.name] ?? tc.name;
  const argsSummary = formatArgs(tc.arguments);
  const isRunning = tc.phase === "start" || tc.phase === "update";
  const hasResult = Boolean(tc.resultText);

  return (
    <div className={`${s.ToolCallCard} ${isRunning ? s["ToolCallCard--live"] : ""}`}>
      <button
        type="button"
        className={s.ToolCallHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={s.ToolCallIcon}>
          <ToolIcon />
        </span>
        <span className={s.ToolCallLabel}>{label}</span>
        {argsSummary ? (
          <span className={s.ToolCallArgs}>{argsSummary}</span>
        ) : null}
        {isRunning ? (
          <span className={s["ToolCallStatus--running"]}>running…</span>
        ) : tc.isError ? (
          <span className={s["ToolCallStatus--error"]}>error</span>
        ) : null}
        <span className={`${s.ToolCallChevron} ${expanded ? s["ToolCallChevron--open"] : ""}`}>
          ▸
        </span>
      </button>
      {expanded && hasResult ? (
        <pre className={s.ToolCallOutput}>{tc.resultText}</pre>
      ) : null}
    </div>
  );
}

/** Render live (in-flight) tool calls streamed via agent events. */
export function LiveToolCallCards({ toolCalls }: { toolCalls: LiveToolCall[] }) {
  if (!toolCalls.length) {return null;}
  return (
    <div className={s.ToolCallCards}>
      {toolCalls.map((tc) => (
        <LiveToolCallCardItem key={tc.toolCallId} tc={tc} />
      ))}
    </div>
  );
}
