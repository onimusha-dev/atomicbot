import React from "react";

import { getDesktopApiOrNull } from "@ipc/desktopApi";
import { GlassCard, HeroPageLayout, PrimaryButton, TextInput } from "@shared/kit";

export function TelegramUserPage(props: {
  status: string | null;
  error: string | null;
  telegramUserId: string;
  setTelegramUserId: (value: string) => void;
  channelsProbe: unknown;
  onNext: () => void;
  onSkip: () => void;
}) {
  const totalSteps = 5;
  const activeStep = 4;

  const [errorText, setErrorText] = React.useState("");
  const token = props.telegramUserId.trim();

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
    <HeroPageLayout variant="compact" align="center" aria-label="Telegram allowlist setup">
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

        <div className="UiApiKeyTitle">Allow Telegram DMs</div>

        <div className="UiContentWrapper scrollable">
          <div className="UiApiKeySubtitle">
            Get your Telegram user id.{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="UiLink"
              onClick={(e) => {
                e.preventDefault();
                void getDesktopApiOrNull()?.openExternal("https://t.me/BotFather");
              }}
            >
              Open BotFather ↗
            </a>
          </div>

          <div className="UiSectionSubtitle">
            <div className="UiSectionSubtitleAccent">Follow these steps</div>
            <ol>
              <li>Open the bot by clicking on the BotFather message</li>
              <li>Click the Start button</li>
              <li>Send a message to your bot</li>
              <li>Copy your Telegram user id</li>
              <li>Paste the token in the field below and click Connect</li>
            </ol>

            <div className="UiApiKeySpacer" aria-hidden="true" />
          </div>

          <div className="UiApiKeyInputRow" style={{ marginBottom: 6 }}>
            <TextInput
              value={props.telegramUserId}
              onChange={props.setTelegramUserId}
              placeholder="123456789"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              isError={errorText}
              label={"Telegram user id"}
            />
          </div>
        </div>

        <div className="UiApiKeyButtonRow">
          <button className="UiTextButton" onClick={props.onSkip} type="button">
            Back
          </button>
          <PrimaryButton size={"sm"} onClick={handleSubmit}>
            Connect
          </PrimaryButton>
        </div>
      </GlassCard>
    </HeroPageLayout>
  );
}
