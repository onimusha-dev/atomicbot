import React from "react";

import { getDesktopApiOrNull } from "@ipc/desktopApi";
import { Modal } from "@shared/kit";

import s from "./RestoreBackupModal.module.css";

type RestoreState = "idle" | "loading" | "error";

export function RestoreBackupModal(props: {
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [state, setState] = React.useState<RestoreState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (props.open) {
      setState("idle");
      setError(null);
      setDragActive(false);
    }
  }, [props.open]);

  const handleFile = React.useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      const supported =
        lower.endsWith(".zip") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz");
      if (!supported) {
        setError("Please upload a .zip or .tar.gz file");
        setState("error");
        return;
      }

      setState("loading");
      setError(null);

      try {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        const api = getDesktopApiOrNull();
        if (!api?.restoreBackup) {
          throw new Error("API not available");
        }

        const result = await api.restoreBackup(base64, file.name);
        if (!result.ok) {
          throw new Error(result.error || "Restore failed");
        }

        props.onRestored();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
      }
    },
    [props]
  );

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer?.files?.[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile]
  );

  const onDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const onFileInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleFile(file);
      }
      // Reset so the same file can be picked again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFile]
  );

  const openFilePicker = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      header="Restore from backup"
      aria-label="Restore from backup"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.gz,.tgz"
        style={{ display: "none" }}
        onChange={onFileInputChange}
      />

      {/* Drag-and-drop zone */}
      <div
        className={`${s.UiRestoreDropZone}${dragActive ? ` ${s["UiRestoreDropZone--active"]}` : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
      >
        {state === "loading" ? (
          <>
            <div className={s.UiRestoreSpinner} aria-label="Restoring backup..." />
            <div className={s.UiRestoreStatusText}>Restoring backup...</div>
          </>
        ) : (
          <>
            <div className={s.UiRestoreDropZoneTitle}>Drag backup archive here</div>
            <div className={s.UiRestoreDropZoneSubtext}>
              Or{" "}
              <button type="button" className={s.UiRestoreChooseFileLink} onClick={openFilePicker}>
                choose a file
              </button>{" "}
              from finder
            </div>
          </>
        )}
      </div>

      {/* Error message */}
      {state === "error" && error ? <div className={s.UiRestoreError}>{error}</div> : null}

      {/* Warning block */}
      <div className={s.UiRestoreWarningBlock}>
        <span className={s.UiRestoreWarningIcon} aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 1L1 14h14L8 1z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path d="M8 6v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="8" cy="12" r="0.75" fill="currentColor" />
          </svg>
        </span>
        <div className={s.UiRestoreWarningText}>
          This will replace your current configuration. A safety backup of your current state will
          be created automatically.
        </div>
      </div>
    </Modal>
  );
}
