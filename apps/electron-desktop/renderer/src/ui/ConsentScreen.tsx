import React from "react";

import { GlassCard, HeroPageLayout, InlineError, PrimaryButton } from "./kit";
import { LoadingScreen } from "./LoadingScreen";

export type ConsentDesktopApi = NonNullable<Window["openclawDesktop"]> & {
  getConsentInfo?: () => Promise<{ accepted: boolean }>;
  acceptConsent?: () => Promise<{ ok: true }>;
  startGateway?: () => Promise<{ ok: true }>;
};

export function ConsentScreen({ onAccepted }: { onAccepted: () => void }) {
  const api = window.openclawDesktop as ConsentDesktopApi | undefined;
  const [checked, setChecked] = React.useState(false);
  const [agreeRequired, setAgreeRequired] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const termsUrl = "https://atomicbot.ai/terms";

  const accept = React.useCallback(async () => {
    if (busy) {
      return;
    }
    if (!checked) {
      setAgreeRequired(true);
      return;
    }
    if (!api || typeof api.acceptConsent !== "function") {
      setError("Desktop API is not available. Please restart the app.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.acceptConsent();
      // Redundant safety: ensure gateway start even if consent handler changes.
      if (typeof api.startGateway === "function") {
        await api.startGateway();
      }
      onAccepted();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [api, busy, checked, onAccepted]);

  if (busy) {
    return <LoadingScreen state={null} />;
  }

  const checkRowClassName = `UiCheckRow${agreeRequired && !checked ? " UiCheckRow--error" : ""}`;

  return (
    <HeroPageLayout
      role="dialog"
      aria-label="User agreement"
      title="WELCOME"
      variant="compact"
      align="center"
    >
      <GlassCard className="UiGlassCard-intro">
        <div className="UiIntroInner">
          <div className="UiSectionTitle">Hi.</div>
          <div className="UiSectionSubtitle">Before we start, please accept the Terms of Use.</div>

          <label className={checkRowClassName}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                const next = e.target.checked;
                setChecked(next);
                if (next) {
                  setAgreeRequired(false);
                }
              }}
            />
            <span>
              I agree to the{" "}
              <a
                className="UiLink"
                href={termsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  // Prevent toggling the checkbox when clicking the link.
                  e.preventDefault();
                  e.stopPropagation();
                  const openExternal = window.openclawDesktop?.openExternal;
                  if (typeof openExternal === "function") {
                    void openExternal(termsUrl);
                    return;
                  }
                  // Fallback for non-desktop contexts.
                  window.open(termsUrl, "_blank", "noopener,noreferrer");
                }}
              >
                Terms of Use
              </a>
              .
            </span>
          </label>

          {error ? <InlineError>{error}</InlineError> : null}

          <PrimaryButton disabled={busy} onClick={() => void accept()}>
            Start
          </PrimaryButton>
        </div>
      </GlassCard>
    </HeroPageLayout>
  );
}

