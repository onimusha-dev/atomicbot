import React from "react";
import type { ChatAttachmentInput } from "@store/slices/chatSlice";
import { ChatAttachmentCard, getFileTypeLabel } from "./ChatAttachmentCard";
import { MicrophoneIcon, SendIcon } from "@shared/kit/icons";
import {
  dataUrlDecodedBytes,
  MAX_ATTACHMENTS_DEFAULT,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_ATTACHMENTS_BYTES,
} from "../utils/file-limits";
import s from "./ChatComposer.module.css";

export type ChatComposerRef = { focusInput: () => void };

export type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  attachments: ChatAttachmentInput[];
  onAttachmentsChange: (
    next: ChatAttachmentInput[] | ((prev: ChatAttachmentInput[]) => ChatAttachmentInput[])
  ) => void;
  onSend: () => void;
  disabled?: boolean;
  /** When true, show stop button instead of send; requires onStop. */
  streaming?: boolean;
  onStop?: () => void;
  sendLabel?: string;
  sendingLabel?: string;
  stopLabel?: string;
  placeholder?: string;
  /** Max attachments (default 5). When exceeded, onAttachmentsLimitError is called. */
  maxAttachments?: number;
  onAttachmentsLimitError?: (message: string) => void;
  /** Voice recording state */
  isVoiceRecording?: boolean;
  isVoiceProcessing?: boolean;
  onVoiceStart?: () => void;
  onVoiceStop?: () => void;
  /** When true, clicking mic shows a "not configured" tooltip instead of recording. */
  voiceNotConfigured?: boolean;
  onNavigateVoiceSettings?: () => void;
};

export const ChatComposer = React.forwardRef<ChatComposerRef, ChatComposerProps>(
  function ChatComposer(
    {
      value,
      onChange,
      attachments,
      onAttachmentsChange,
      onSend,
      disabled = false,
      streaming = false,
      onStop,
      sendLabel = "Send",
      sendingLabel = "Sending...",
      stopLabel = "Stop",
      placeholder = "Message...",
      maxAttachments = MAX_ATTACHMENTS_DEFAULT,
      onAttachmentsLimitError,
      isVoiceRecording = false,
      isVoiceProcessing = false,
      onVoiceStart,
      onVoiceStop,
      voiceNotConfigured = false,
      onNavigateVoiceSettings,
    },
    ref
  ) {
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const [showMicTooltip, setShowMicTooltip] = React.useState(false);
    const micTooltipRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (!showMicTooltip) return;
      const handle = (e: MouseEvent) => {
        if (micTooltipRef.current && !micTooltipRef.current.contains(e.target as Node)) {
          setShowMicTooltip(false);
        }
      };
      document.addEventListener("mousedown", handle);
      return () => document.removeEventListener("mousedown", handle);
    }, [showMicTooltip]);

    React.useImperativeHandle(ref, () => ({
      focusInput() {
        textareaRef.current?.focus();
      },
    }));

    const MIN_INPUT_HEIGHT = 28;
    const MAX_INPUT_HEIGHT = 180;

    const adjustTextareaHeight = React.useCallback(() => {
      const el = textareaRef.current;
      if (!el) {
        return;
      }
      el.style.height = "0";
      const next = Math.min(Math.max(el.scrollHeight, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT);
      el.style.height = `${next}px`;
    }, []);

    React.useLayoutEffect(() => {
      adjustTextareaHeight();
    }, [value, adjustTextareaHeight]);

    const addFiles = React.useCallback(
      (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (!fileArray.length) {
          return;
        }

        const currentCount = attachments.length;
        const currentTotalBytes = attachments.reduce(
          (sum, a) => sum + dataUrlDecodedBytes(a.dataUrl),
          0
        );
        if (currentCount >= maxAttachments) {
          onAttachmentsLimitError?.(
            `Maximum ${maxAttachments} attachment${maxAttachments === 1 ? "" : "s"} allowed.`
          );
          return;
        }

        const add: ChatAttachmentInput[] = [];
        let addedBytes = 0;
        const maxNewCount = maxAttachments - currentCount;
        let totalSizeShown = false;
        let oversizedShown = false;

        let expectedCount = 0;
        for (let i = 0; i < fileArray.length && expectedCount < maxNewCount; i += 1) {
          const file = fileArray[i];
          if (file.size > MAX_FILE_SIZE_BYTES) {
            if (!oversizedShown) {
              oversizedShown = true;
              onAttachmentsLimitError?.("File is too large. Maximum size per file is 5MB.");
            }
            continue;
          }
          const wouldTotal = currentTotalBytes + addedBytes + file.size;
          if (wouldTotal > MAX_TOTAL_ATTACHMENTS_BYTES) {
            if (!totalSizeShown) {
              totalSizeShown = true;
              onAttachmentsLimitError?.(
                `Total attachments size exceeds ${MAX_TOTAL_ATTACHMENTS_BYTES / (1024 * 1024)}MB.`
              );
            }
            continue;
          }
          addedBytes += file.size;
          expectedCount += 1;
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            const dataUrl = reader.result as string;
            add.push({
              id: crypto.randomUUID(),
              dataUrl,
              mimeType: file.type || "application/octet-stream",
              fileName: file.name,
            });
            if (add.length === expectedCount) {
              onAttachmentsChange((prev) => [...prev, ...add]);
              requestAnimationFrame(() => textareaRef.current?.focus());
            }
          });
          reader.addEventListener("error", () => {
            if (add.length === expectedCount) {
              onAttachmentsChange((prev) => [...prev, ...add]);
              requestAnimationFrame(() => textareaRef.current?.focus());
            }
          });
          reader.readAsDataURL(file);
        }

        if (fileArray.length > maxNewCount && expectedCount === maxNewCount) {
          onAttachmentsLimitError?.(
            `Maximum ${maxAttachments} attachment${maxAttachments === 1 ? "" : "s"} allowed.`
          );
        }
      },
      [attachments, maxAttachments, onAttachmentsChange, onAttachmentsLimitError]
    );

    const onFileChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files?.length) {
          addFiles(files);
        }
        e.target.value = "";
      },
      [addFiles]
    );

    const removeAttachment = React.useCallback(
      (id: string) => {
        onAttachmentsChange((prev) => prev.filter((a) => a.id !== id));
      },
      [onAttachmentsChange]
    );

    const onDrop = React.useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer?.files;
        if (files?.length) {
          addFiles(files);
        }
      },
      [addFiles]
    );

    const onDragOver = React.useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const canSend = value.trim().length > 0;

    return (
      <div
        className={s.UiChatComposer}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
      >
        <div className={s.UiChatComposerInner}>
          {attachments.length > 0 && (
            <div className={s.UiChatAttachments}>
              {attachments.map((att) => {
                const isImage = att.mimeType.startsWith("image/");
                if (isImage) {
                  return (
                    <div key={att.id} className={s.UiChatAttachment}>
                      <img src={att.dataUrl} alt="" className={s.UiChatAttachmentImg} />
                      <button
                        type="button"
                        className={s.UiChatAttachmentRemove}
                        onClick={() => removeAttachment(att.id)}
                        aria-label="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  );
                }
                return (
                  <ChatAttachmentCard
                    key={att.id}
                    fileName={att.fileName ?? getFileTypeLabel(att.mimeType)}
                    mimeType={att.mimeType}
                    onRemove={() => removeAttachment(att.id)}
                  />
                );
              })}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="*"
            multiple
            className={s.UiChatFileInput}
            aria-hidden
            onChange={onFileChange}
          />

          <textarea
            ref={textareaRef}
            className={s.UiChatInput}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />

          <div className={s.UiChatComposerButtonBlock}>
            <button
              type="button"
              className={s.UiChatAttachButton}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              title="Attach file or image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
              >
                <path
                  d="M9.00012 3.1499V14.8499M14.8501 8.9999H3.15012"
                  stroke="white"
                  strokeWidth="1.503"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className={s.UiChatComposerButtonGroup}>
              {onVoiceStart && (
                <div className={s.UiChatMicWrap} ref={micTooltipRef}>
                  <button
                    type="button"
                    className={`${s.UiChatMicButton}${isVoiceRecording ? ` ${s["UiChatMicButton--recording"]}` : ""}${isVoiceProcessing ? ` ${s["UiChatMicButton--processing"]}` : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (voiceNotConfigured) {
                        setShowMicTooltip((v) => !v);
                        return;
                      }
                      if (!isVoiceRecording && !isVoiceProcessing) {
                        onVoiceStart();
                      }
                    }}
                    onMouseUp={(e) => {
                      e.preventDefault();
                      if (voiceNotConfigured) return;
                      if (isVoiceRecording) {
                        onVoiceStop?.();
                      }
                    }}
                    onMouseLeave={() => {
                      if (voiceNotConfigured) return;
                      if (isVoiceRecording) {
                        onVoiceStop?.();
                      }
                    }}
                    disabled={disabled || isVoiceProcessing}
                    aria-label={
                      voiceNotConfigured
                        ? "Voice not configured"
                        : isVoiceRecording
                          ? "Release to stop recording"
                          : isVoiceProcessing
                            ? "Transcribing..."
                            : "Hold to record voice"
                    }
                    title={
                      voiceNotConfigured
                        ? "Voice not configured"
                        : isVoiceRecording
                          ? "Release to stop"
                          : isVoiceProcessing
                            ? "Transcribing..."
                            : "Hold to record"
                    }
                  >
                    <MicrophoneIcon />
                  </button>
                  {showMicTooltip && (
                    <div className={s.UiChatMicTooltip}>
                      <div className={s.UiChatMicTooltipText}>Voice is not configured.</div>
                      <button
                        type="button"
                        className={s.UiChatMicTooltipLink}
                        onClick={() => {
                          setShowMicTooltip(false);
                          onNavigateVoiceSettings?.();
                        }}
                      >
                        Settings → Voice
                      </button>
                    </div>
                  )}
                </div>
              )}

              {streaming && onStop ? (
                <button
                  type="button"
                  className={`${s.UiChatSendButton} ${s.UiChatStopButton}`}
                  onClick={onStop}
                  aria-label={stopLabel}
                  title={stopLabel}
                >
                  <div className={s.UiChatStopButtonInner} />
                </button>
              ) : (
                <button
                  type="button"
                  className={s.UiChatSendButton}
                  onClick={onSend}
                  disabled={disabled || !canSend}
                  aria-label={disabled ? sendingLabel : sendLabel}
                  title={disabled ? sendingLabel : sendLabel}
                >
                  <SendIcon />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
