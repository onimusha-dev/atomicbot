import React from "react";

import { GlassCard, HeroPageLayout, PrimaryButton, TextInput } from "../kit";

export function NotionConnectPage(props: {
  status: string | null;
  error: string | null;
  busy: boolean;
  onSubmit: (apiKey: string) => void;
  onBack: () => void;
}) {
  const [apiKey, setApiKey] = React.useState("");
  const [errorText, setErrorText] = React.useState("");
  const totalSteps = 5;
  const activeStep = 3;

  const handleSubmit = () => {
    if (errorText) {
      setErrorText("");
    }

    const trimmed = apiKey.trim();
    if (trimmed && trimmed.length > 3) {
      props.onSubmit(trimmed);
    } else {
      setErrorText("Please enter your API key to continue");
    }
  };

  return (
    <HeroPageLayout variant="compact" align="center" aria-label="Notion setup">
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

        <div className="UiApiKeyTitle">Connect Notion</div>

        <div className="UiContentWrapper">
          <div className="UiApiKeySubtitle">
            Create a Notion integration, copy its API key, then share the target pages/databases
            with the integration.{" "}
            <a
              href="https://notion.so/my-integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="UiLink"
              onClick={(e) => {
                e.preventDefault();
                void window.openclawDesktop?.openExternal("https://notion.so/my-integrations");
              }}
            >
              Open integrations ↗
            </a>
          </div>

          <div className="UiSectionSubtitle">
            Steps:
            <ol>
              <li>Create an integration.</li>
              <li>Copy the API key (usually starts with ntn_ or secret_).</li>
              <li>Share the pages/databases you want to use with the integration.</li>
            </ol>
          </div>

          {/*{props.status ? <div className="UiSectionSubtitle">{props.status}</div> : null}*/}

          <div className="UiApiKeyInputRow">
            <TextInput
              type="password"
              value={apiKey}
              onChange={setApiKey}
              placeholder="ntn_..."
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={props.busy}
              label={"Notion API key"}
              isError={errorText}
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
