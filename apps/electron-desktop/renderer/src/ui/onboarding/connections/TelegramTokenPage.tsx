import React from "react";

import { getDesktopApiOrNull } from "@ipc/desktopApi";
import { GlassCard, HeroPageLayout, PrimaryButton, TextInput } from "@shared/kit";

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

        <div className="UiContentWrapper scrollable">
          <div className="UiApiKeySubtitle">
            Get your bot token from the Telegram.{" "}
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
              Get bot token ↗
            </a>
          </div>

          <div className="UiSectionSubtitle">
            <div className="UiSectionSubtitleAccent">How to get your Telegram bot token?</div>
            <ol>
              <li>
                <div>
                  Open Telegram and go to{" "}
                  <span className="UiSectionSubtitleAccent">@BotFather</span>
                </div>
              </li>
              <li>
                <div>
                  Start a chat and type <span className="UiSectionSubtitleAccent">/newbot</span>
                </div>
              </li>
              <li>Follow the prompts to name your bot and choose a username</li>
              <li>
                BotFather will send you a message with your bot token. Copy the entire token (it
                looks like a long string of numbers and letters)
              </li>
              <li>Paste the token in the field below and click Continue</li>
            </ol>
          </div>

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
              label={"Telegram bot token"}
            />
          </div>

          <div className="UiApiKeySpacer" aria-hidden="true" />
        </div>

        <div className="UiApiKeyButtonRow">
          <button className="UiTextButton" onClick={props.onSkip} type="button">
            Back
          </button>
          <PrimaryButton size={"sm"} onClick={handleSubmit}>
            Continue
          </PrimaryButton>
        </div>
      </GlassCard>
    </HeroPageLayout>
  );
}
