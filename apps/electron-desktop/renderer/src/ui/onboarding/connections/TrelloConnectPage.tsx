import React from "react";

import { getDesktopApiOrNull } from "@ipc/desktopApi";
import { GlassCard, HeroPageLayout, PrimaryButton, TextInput } from "@shared/kit";

export function TrelloConnectPage(props: {
  status: string | null;
  error: string | null;
  busy: boolean;
  onSubmit: (apiKey: string, token: string) => void;
  onBack: () => void;
}) {
  const [apiKey, setApiKey] = React.useState("");
  const [token, setToken] = React.useState("");
  const totalSteps = 5;
  const activeStep = 3;
  const [errors, setErrors] = React.useState<{
    apiKey?: string;
    token?: string;
  }>({});

  const handleSubmit = () => {
    const trimmedKey = apiKey.trim();
    const trimmedToken = token.trim();

    const nextErrors: typeof errors = {};

    if (!trimmedKey) {
      nextErrors.apiKey = "Please enter your Trello API key";
    }

    if (!trimmedToken) {
      nextErrors.token = "Please enter your Trello token";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    props.onSubmit(trimmedKey, trimmedToken);
  };

  return (
    <HeroPageLayout variant="compact" align="center" aria-label="Trello setup">
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

        <div className="UiApiKeyTitle">Connect Trello</div>

        <div className="UiContentWrapper scrollable">
          <div className="UiApiKeySubtitle">
            Get your Trello API key and token from{" "}
            <a
              href="https://trello.com/app-key"
              target="_blank"
              rel="noopener noreferrer"
              className="UiLink"
              onClick={(e) => {
                e.preventDefault();
                void getDesktopApiOrNull()?.openExternal("https://trello.com/app-key");
              }}
            >
              trello.com/app-key ↗
            </a>
          </div>

          <div className="UiSectionSubtitle">
            Steps:
            <ol>
              <li>Open the app key page.</li>
              <li>Copy your API key.</li>
              <li>Click the Token link and generate a token.</li>
              <li>Paste both values here.</li>
            </ol>
          </div>

          {/*{props.status ? <div className="UiSectionSubtitle">{props.status}</div> : null}*/}

          <div className="UiApiKeyInputRow" style={{ display: "grid", gap: 10 }}>
            <TextInput
              type="password"
              value={apiKey}
              onChange={setApiKey}
              label="Trello API key"
              placeholder="Trello API key"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={props.busy}
              isError={errors.apiKey}
            />
            <TextInput
              type="password"
              value={token}
              onChange={setToken}
              label="Trello token"
              placeholder="Trello token"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={props.busy}
              isError={errors.token}
            />
          </div>

          <div className="UiApiKeySpacer" aria-hidden="true" />
        </div>

        <div className="UiApiKeyButtonRow">
          <button
            className="UiTextButton"
            disabled={props.busy}
            onClick={props.onBack}
            type="button"
          >
            Back
          </button>
          <PrimaryButton size={"sm"} disabled={props.busy} onClick={handleSubmit}>
            Connect
          </PrimaryButton>
        </div>
      </GlassCard>
    </HeroPageLayout>
  );
}
