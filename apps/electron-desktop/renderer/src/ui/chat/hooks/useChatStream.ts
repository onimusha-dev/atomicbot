import React from "react";
import type { AppDispatch } from "@store/store";
import {
  chatActions,
  extractText,
} from "@store/slices/chatSlice";

type ChatEvent = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

type GatewayRpc = {
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
      if (evt.event !== "chat") {
        return;
      }
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
        dispatch(chatActions.streamFinalReceived({ runId: payload.runId, seq: payload.seq, text }));
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
    });
  }, [dispatch, gw, sessionKey]);
}
