import React from "react";

import { GlassCard, HeroPageLayout, PrimaryButton, TextInput } from "../kit";

export function TelegramTokenPage(props: {
  status: string | null;
  error: string | null;
  telegramToken: string;
  setTelegramToken: (value: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const totalSteps = 5;
  const activeStep = 4;
  const [errorText, setErrorText] = React.useState("");
  const token = props.telegramToken.trim();

  const handleSubmit = () => {
    if (errorText) {
      setErrorText("");
    }

    if (token) {
      props.onNext();
    } else {
      setErrorText("Please enter your token to continue");
    }
  };

  return (
    <HeroPageLayout variant="compact" align="center" aria-label="Telegram token setup">
      <GlassCard className="UiApiKeyCard UiGlassCardOnboarding">
        <div className="UiOnboardingDots" aria-label="Onboarding progress">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              className={`UiOnboardingDot ${idx === activeStep ? "UiOnboardingDot--active" : ""}`}
              aria-hidden="true"
            />
          ))}
        </div>

        <div className="UiApiKeyTitle">Connect Telegram</div>

        <div className="UiContentWrapper">
          <div className="UiApiKeySubtitle">
            Paste your bot token from <strong>@BotFather</strong>. We'll store it under{" "}
            <code>channels.telegram.botToken</code>.
          </div>

          <div className="UiSectionSubtitle">
            Steps:
            <ol>
              <li>Create a bot with @BotFather and copy the token.</li>
              <li>Paste the token here and save.</li>
            </ol>
            Docs:{" "}
            <a
              href="https://docs.openclaw.ai/channels/telegram"
              target="_blank"
              rel="noopener noreferrer"
              className="UiLink"
              onClick={(e) => {
                e.preventDefault();
                void window.openclawDesktop?.openExternal(
                  "https://docs.openclaw.ai/channels/telegram"
                );
              }}
            >
              Telegram setup ↗
            </a>
          </div>

          {props.status ? <div className="UiSectionSubtitle">{props.status}</div> : null}

          <div className="UiApiKeyInputRow">
            <TextInput
              type="password"
              value={props.telegramToken}
              onChange={props.setTelegramToken}
              placeholder="123456789:ABCDEF..."
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              isError={errorText}
            />
          </div>

          <div className="UiApiKeySpacer" aria-hidden="true" />
        </div>

        <div className="UiApiKeyButtonRow">
          <button className="UiTextButton" onClick={props.onSkip} type="button">
            Back
          </button>
          <PrimaryButton size={"sm"} onClick={handleSubmit}>
            Save & continue
          </PrimaryButton>
        </div>
      </GlassCard>
    </HeroPageLayout>
  );
}
