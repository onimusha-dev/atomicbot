import React from "react";
import { useNavigate } from "react-router-dom";

import { getDesktopApiOrNull } from "@ipc/desktopApi";
import { GlassCard, HeroPageLayout } from "@shared/kit";
import { useAppDispatch } from "@store/hooks";
import { setOnboarded } from "@store/slices/onboardingSlice";
import { routes } from "../app/routes";

import s from "./RestoreFilePage.module.css";

type PageState = "idle" | "loading" | "error";

export function RestoreFilePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [pageState, setPageState] = React.useState<PageState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = React.useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      const supported =
        lower.endsWith(".zip") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz");
      if (!supported) {
        setError("Please upload a .zip or .tar.gz file");
        setPageState("error");
        return;
      }

      setPageState("loading");
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

        void dispatch(setOnboarded(true));
        void navigate(routes.chat, { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPageState("error");
      }
    },
    [navigate]
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFile]
  );

  const openFilePicker = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleBack = React.useCallback(() => {
    void navigate(`${routes.welcome}/restore`);
  }, [navigate]);

  const totalSteps = 5;
  const activeStep = 0;

  return (
    <HeroPageLayout variant="compact" align="center" aria-label="Restore from backup file">
      <GlassCard className={`UiGlassCardOnboarding ${s.UiRestoreCard}`}>
        <div className="UiOnboardingDots" aria-label="Onboarding progress">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <span
              key={idx}
              className={`UiOnboardingDot ${idx === activeStep ? "UiOnboardingDot--active" : ""}`}
              aria-hidden="true"
            />
          ))}
        </div>

        <div className="UiSectionTitle">Restore from backup</div>
        <div className="UiSectionSubtitle">
          Upload a backup archive to restore your OpenClaw configuration
        </div>

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
          {pageState === "loading" ? (
            <>
              <div className={s.UiRestoreSpinner} aria-label="Restoring backup..." />
              <div className={s.UiRestoreStatusText}>Restoring backup...</div>
            </>
          ) : (
            <>
              <div className={s.UiRestoreDropZoneTitle}>Drag backup archive here</div>
              <div className={s.UiRestoreDropZoneSubtext}>
                Or{" "}
                <button
                  type="button"
                  className={s.UiRestoreChooseFileLink}
                  onClick={openFilePicker}
                >
                  choose a file
                </button>{" "}
                from finder
              </div>
            </>
          )}
        </div>

        {/* Error message */}
        {pageState === "error" && error ? <div className={s.UiRestoreError}>{error}</div> : null}

        <div className={`UiSkillsBottomRow ${s.UiRestoreCardBottom}`}>
          <button
            className="UiTextButton"
            onClick={handleBack}
            type="button"
            disabled={pageState === "loading"}
          >
            Back
          </button>
        </div>
      </GlassCard>
    </HeroPageLayout>
  );
}
