import React from "react";
import type { AppDispatch } from "@store/store";
import {
  chatActions,
  extractText,
  extractToolCalls,
  loadChatHistory,
} from "@store/slices/chatSlice";

type ChatEvent = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

type AgentEvent = {
  runId: string;
  seq: number;
  stream: string;
  ts: number;
  sessionKey?: string;
  data: Record<string, unknown>;
};

type GatewayRpc = {
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  onEvent: (cb: (evt: { event: string; payload: unknown }) => void) => () => void;
};

/** Subscribe to gateway chat events and dispatch stream actions for the given session. */
export function useChatStream(
  gw: GatewayRpc,
  dispatch: AppDispatch,
  sessionKey: string
) {
  React.useEffect(() => {
    return gw.onEvent((evt) => {
      // Handle chat events (text streaming)
      if (evt.event === "chat") {
        const payload = evt.payload as ChatEvent;
        if (payload.sessionKey !== sessionKey) {
          return;
        }
        if (payload.state === "delta") {
          const text = extractText(payload.message);
          dispatch(chatActions.streamDeltaReceived({ runId: payload.runId, text }));
          return;
        }
      if (payload.state === "final") {
        const text = extractText(payload.message);
        const toolCalls = extractToolCalls(payload.message);
        // streamFinalReceived also collects live tool calls for this runId
        // and merges them into the finalized message, then clears them.
        dispatch(
          chatActions.streamFinalReceived({
            runId: payload.runId,
            seq: payload.seq,
            text,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          })
        );
        // Reload full chat history from the server, matching the web admin
        // behavior. The server-side history contains final tool results
        // (e.g. after exec approval) which replace the streamed versions.
        void dispatch(
          loadChatHistory({ request: gw.request, sessionKey, limit: 200 })
        );
        return;
      }
      if (payload.state === "error") {
        dispatch(
          chatActions.streamErrorReceived({
            runId: payload.runId,
            errorMessage: payload.errorMessage,
          })
        );
        return;
      }
      if (payload.state === "aborted") {
        dispatch(chatActions.streamAborted({ runId: payload.runId }));
      }
        return;
      }

      // Handle agent events (tool call streaming)
      if (evt.event === "agent") {
        const payload = evt.payload as AgentEvent;
        if (payload.sessionKey && payload.sessionKey !== sessionKey) {
          return;
        }
        if (payload.stream !== "tool") {
          return;
        }
        const { data, runId } = payload;
        const phase = typeof data.phase === "string" ? data.phase : "";
        const toolCallId = typeof data.toolCallId === "string" ? data.toolCallId : "";
        const name = typeof data.name === "string" ? data.name : "";

        if (phase === "start" && toolCallId && name) {
          const args =
            data.args && typeof data.args === "object"
              ? (data.args as Record<string, unknown>)
              : {};
          dispatch(
            chatActions.toolCallStarted({ toolCallId, runId, name, arguments: args })
          );
          return;
        }
        if (phase === "result" && toolCallId) {
          const resultText =
            typeof data.result === "string"
              ? data.result
              : data.result != null
                ? JSON.stringify(data.result, null, 2)
                : undefined;
          dispatch(
            chatActions.toolCallFinished({
              toolCallId,
              resultText,
              isError: typeof data.isError === "boolean" ? data.isError : undefined,
            })
          );
        }
      }
    });
  }, [dispatch, gw, sessionKey]);
}
