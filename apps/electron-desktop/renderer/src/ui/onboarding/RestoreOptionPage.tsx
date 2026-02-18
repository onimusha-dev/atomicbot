import React from "react";
import { useNavigate } from "react-router-dom";

import { getDesktopApiOrNull } from "@ipc/desktopApi";
import { GlassCard, HeroPageLayout, PrimaryButton } from "@shared/kit";
import { useAppDispatch } from "@store/hooks";
import { setOnboarded } from "@store/slices/onboardingSlice";
import { routes } from "../app/routes";

import s from "./RestoreOptionPage.module.css";

type RestoreOption = "local" | "file";

type PageState = "idle" | "loading" | "error";

export function RestoreOptionPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [selected, setSelected] = React.useState<RestoreOption>("local");
  const [pageState, setPageState] = React.useState<PageState>("idle");
  const [error, setError] = React.useState<string | null>(null);

  const handleBack = React.useCallback(() => {
    void navigate(routes.consent);
  }, [navigate]);

  const handleContinue = React.useCallback(async () => {
    if (selected === "file") {
      void navigate(`${routes.welcome}/restore-file`);
      return;
    }

    // "local" option: auto-detect ~/.openclaw, then restore or open folder picker
    const api = getDesktopApiOrNull();
    if (!api?.detectLocalOpenclaw || !api.restoreFromDirectory || !api.selectOpenclawFolder) {
      setError("Desktop API is not available. Please restart the app.");
      setPageState("error");
      return;
    }

    setPageState("loading");
    setError(null);

    try {
      const detection = await api.detectLocalOpenclaw();

      if (detection.found) {
        // Found local instance — restore directly
        const result = await api.restoreFromDirectory(detection.path);
        if (!result.ok) {
          throw new Error(result.error || "Restore failed");
        }
        void dispatch(setOnboarded(true));
        void navigate(routes.chat, { replace: true });
        return;
      }

      // Not found — open Finder folder picker
      const folderResult = await api.selectOpenclawFolder();
      if (folderResult.cancelled) {
        setPageState("idle");
        return;
      }
      if (!folderResult.ok || !folderResult.path) {
        throw new Error(
          folderResult.error || "Selected folder does not contain a valid OpenClaw configuration."
        );
      }

      // Restore from selected folder
      const restoreResult = await api.restoreFromDirectory(folderResult.path);
      if (!restoreResult.ok) {
        throw new Error(restoreResult.error || "Restore failed");
      }
      void dispatch(setOnboarded(true));
      void navigate(routes.chat, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPageState("error");
    }
  }, [selected, navigate]);

  const totalSteps = 5;
  const activeStep = 0;

  return (
    <HeroPageLayout variant="compact" align="center" aria-label="Restore option">
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

        <div className="UiSectionTitle">Choose restore option</div>
        <div className="UiSectionSubtitle">
          Import an existing setup and continue where you left off
        </div>

        <div className={s.UiRestoreOptions}>
          <label
            className={`${s.UiRestoreOptionCard} ${selected === "local" ? s["UiRestoreOptionCard--selected"] : ""}`}
          >
            <input
              type="radio"
              name="restore-option"
              value="local"
              checked={selected === "local"}
              onChange={() => setSelected("local")}
              className={s.UiRestoreRadio}
            />
            <span className={s.UiRestoreOptionIcon} aria-hidden="true">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="2"
                  y="3"
                  width="20"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M8 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <div className={s.UiRestoreOptionText}>
              <div className={s.UiRestoreOptionName}>Restore from local OpenClaw instance</div>
              <div className={s.UiRestoreOptionDesc}>
                Automatically detect and import an OpenClaw instance on this device.
              </div>
            </div>
          </label>

          <label
            className={`${s.UiRestoreOptionCard} ${selected === "file" ? s["UiRestoreOptionCard--selected"] : ""}`}
          >
            <input
              type="radio"
              name="restore-option"
              value="file"
              checked={selected === "file"}
              onChange={() => setSelected("file")}
              className={s.UiRestoreRadio}
            />
            <span className={s.UiRestoreOptionIcon} aria-hidden="true">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <div className={s.UiRestoreOptionText}>
              <div className={s.UiRestoreOptionName}>Restore from backup file</div>
              <div className={s.UiRestoreOptionDesc}>
                Upload a backup file to restore your OpenClaw configuration.
              </div>
            </div>
          </label>
        </div>

        {pageState === "error" && error ? <div className={s.UiRestoreError}>{error}</div> : null}

        {pageState === "loading" ? (
          <div className={s.UiRestoreLoading}>
            <span className={s.UiRestoreSpinner} aria-hidden="true" />
            <span>Restoring configuration...</span>
          </div>
        ) : null}

        <div className={`UiSkillsBottomRow ${s.UiRestoreCardBottom}`}>
          <button
            className="UiTextButton"
            onClick={handleBack}
            type="button"
            disabled={pageState === "loading"}
          >
            Back
          </button>
          <PrimaryButton
            size="sm"
            onClick={() => void handleContinue()}
            disabled={pageState === "loading"}
            loading={pageState === "loading"}
          >
            Continue
          </PrimaryButton>
        </div>
      </GlassCard>
    </HeroPageLayout>
  );
}
