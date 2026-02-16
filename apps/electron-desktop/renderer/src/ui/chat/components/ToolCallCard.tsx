import React from "react";
import type { UiToolCall, UiToolResult, LiveToolCall, UiMessageAttachment } from "@store/slices/chatSlice";
import { ChatAttachmentCard, getFileTypeLabel } from "./ChatAttachmentCard";
import s from "./ToolCallCard.module.css";

/** Flat wide chevron icon — points down by default, rotated via CSS when expanded. */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`${s.ToolCallChevron} ${open ? s["ToolCallChevron--open"] : ""}`}
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
  );
}

/** Tool names that should be hidden from the chat UI. */
export const HIDDEN_TOOL_NAMES: ReadonlySet<string> = new Set(["process"]);

/** Human-readable labels for known tool names. */
const TOOL_LABELS: Record<string, string> = {
  exec: "Run command",
  read: "Read file",
  write: "Write file",
  search: "Search",
  browser: "Browser",
};

/** Extract all tool arguments as displayable key-value entries. */
function getArgEntries(args: Record<string, unknown>): { key: string; value: string }[] {
  const entries: { key: string; value: string }[] = [];
  for (const [key, val] of Object.entries(args)) {
    if (val === undefined || val === null) continue;
    const str = typeof val === "string" ? val : JSON.stringify(val);
    entries.push({ key, value: str });
  }
  return entries;
}

/** Render images and file attachments from a tool result. */
function ToolResultAttachments({ attachments }: { attachments: UiMessageAttachment[] }) {
  const images = attachments.filter((a) => a.dataUrl && a.mimeType?.startsWith("image/"));
  const files = attachments.filter(
    (a) => !(a.dataUrl && a.mimeType?.startsWith("image/")),
  );

  return (
    <div className={s.ToolCallAttachments}>
      {images.map((att, idx) => (
        <div key={`img-${idx}`} className={s.ToolCallAttachmentImage}>
          <img src={att.dataUrl} alt="" className={s.ToolCallAttachmentImg} />
        </div>
      ))}
      {files.map((att, idx) => {
        const mimeType = att.mimeType ?? "application/octet-stream";
        return (
          <ChatAttachmentCard
            key={`file-${idx}`}
            fileName={getFileTypeLabel(mimeType)}
            mimeType={mimeType}
          />
        );
      })}
    </div>
  );
}

/** Render a single tool call as an inline collapsible section. */
export function ToolCallCard({
  toolCall,
  result,
}: {
  toolCall: UiToolCall;
  result?: UiToolResult;
}) {
  const hasImages = result?.attachments?.some(
    (a) => a.dataUrl && a.mimeType?.startsWith("image/"),
  ) ?? false;
  const [expanded, setExpanded] = React.useState(hasImages);
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const hasResult = Boolean(result?.text);
  const hasAttachments = Boolean(result?.attachments?.length);
  const argEntries = getArgEntries(toolCall.arguments);

  return (
    <div className={s.ToolCallCard}>
      <button
        type="button"
        className={s.ToolCallHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={s.ToolCallLabel}>{label}</span>
        <ChevronIcon open={expanded} />
      </button>
      {expanded ? (
        <div className={s.ToolCallBody}>
          {argEntries.map((entry) => (
            <div key={entry.key} className={s.ToolCallArgLine}>
              <span className={s.ToolCallArgKey}>{entry.key}:</span>{" "}
              <span className={s.ToolCallArgValue}>{entry.value}</span>
            </div>
          ))}
          {result?.status ? (
            <div className={`${s.ToolCallStatusLine} ${
              result.status === "approved"
                ? s["ToolCallStatusLine--approved"]
                : result.status === "denied"
                  ? s["ToolCallStatusLine--denied"]
                  : result.status === "approval-pending"
                    ? s["ToolCallStatusLine--pending"]
                    : ""
            }`}>
              <span className={s.ToolCallStatusIcon}>
                {result.status === "approved" ? "\u2713" : result.status === "denied" ? "\u2717" : "\u23F3"}
              </span>
              <span className={s.ToolCallStatusText}>
                {result.status === "approved" ? "Approved" : result.status === "denied" ? "Denied" : "Pending"}
              </span>
            </div>
          ) : null}
          {hasResult ? (
            <div className={s.ToolCallResultText}>{result!.text}</div>
          ) : null}
          {hasAttachments ? (
            <ToolResultAttachments attachments={result!.attachments!} />
          ) : null}
        </div>
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
  const visible = toolCalls.filter((tc) => !HIDDEN_TOOL_NAMES.has(tc.name));
  if (!visible.length) {return null;}
  const resultMap = new Map<string, UiToolResult>();
  for (const r of toolResults ?? []) {
    if (r.toolCallId) {resultMap.set(r.toolCallId, r);}
  }
  return (
    <div className={s.ToolCallCards}>
      {visible.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} result={resultMap.get(tc.id)} />
      ))}
    </div>
  );
}

/** Render a single live tool call card (real-time via agent events). */
function LiveToolCallCardItem({ tc }: { tc: LiveToolCall }) {
  const [expanded, setExpanded] = React.useState(false);
  const label = TOOL_LABELS[tc.name] ?? tc.name;
  const isRunning = tc.phase === "start" || tc.phase === "update";
  const hasResult = Boolean(tc.resultText);
  const argEntries = getArgEntries(tc.arguments);

  return (
    <div className={`${s.ToolCallCard} ${isRunning ? s["ToolCallCard--live"] : ""}`}>
      <button
        type="button"
        className={s.ToolCallHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={s.ToolCallCursor}>{"\u2022"}</span>
        <span className={s.ToolCallLabel}>{label}</span>
        <ChevronIcon open={expanded} />
      </button>
      {expanded ? (
        <div className={s.ToolCallBody}>
          {argEntries.map((entry) => (
            <div key={entry.key} className={s.ToolCallArgLine}>
              <span className={s.ToolCallArgKey}>{entry.key}:</span>{" "}
              <span className={s.ToolCallArgValue}>{entry.value}</span>
            </div>
          ))}
          {isRunning ? (
            <div className={`${s.ToolCallStatusLine} ${s["ToolCallStatusLine--running"]}`}>
              <span className={s.ToolCallStatusIcon}>{"\u27F3"}</span>
              <span className={s.ToolCallStatusText}>Running\u2026</span>
            </div>
          ) : tc.isError ? (
            <div className={`${s.ToolCallStatusLine} ${s["ToolCallStatusLine--error"]}`}>
              <span className={s.ToolCallStatusIcon}>{"\u2717"}</span>
              <span className={s.ToolCallStatusText}>Error</span>
            </div>
          ) : null}
          {hasResult ? (
            <div className={s.ToolCallResultText}>{tc.resultText}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Render live (in-flight) tool calls streamed via agent events. */
export function LiveToolCallCards({ toolCalls }: { toolCalls: LiveToolCall[] }) {
  const visible = toolCalls.filter((tc) => !HIDDEN_TOOL_NAMES.has(tc.name));
  if (!visible.length) {return null;}
  return (
    <div className={s.ToolCallCards}>
      {visible.map((tc) => (
        <LiveToolCallCardItem key={tc.toolCallId} tc={tc} />
      ))}
    </div>
  );
}
