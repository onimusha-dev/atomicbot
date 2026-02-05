import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import type { GatewayState } from "../../../src/main/types";
import { routes } from "./routes";
import { GlassCard, HeroPageLayout, InlineError, PrimaryButton } from "./kit";
import { LoadingScreen } from "./LoadingScreen";
import { ApiKeyPage } from "./onboarding/ApiKeyPage";
import { GogPage } from "./onboarding/GogPage";
import { ModelSelectPage } from "./onboarding/ModelSelectPage";
import { ProviderSelectPage } from "./onboarding/ProviderSelectPage";
import { SkillsSetupPage } from "./onboarding/SkillsSetupPage";
import { TelegramTokenPage } from "./onboarding/TelegramTokenPage";
import { TelegramUserPage } from "./onboarding/TelegramUserPage";
import { useWelcomeState } from "./onboarding/welcome/useWelcomeState";

function WelcomeAutoStart(props: { startBusy: boolean; error: string | null; onStart: () => void }) {
  const didStartRef = React.useRef(false);

  React.useEffect(() => {
    if (didStartRef.current) {
      return;
    }
    didStartRef.current = true;
    props.onStart();
  }, [props.onStart]);

  if (props.startBusy) {
    return <LoadingScreen state={null} />;
  }

  if (props.error) {
    return (
      <HeroPageLayout title="WELCOME" variant="compact" align="center" aria-label="Welcome setup">
        <GlassCard className="UiGlassCard-intro">
          <div className="UiIntroInner">
            <div className="UiSectionTitle">Setup failed.</div>
            <div className="UiSectionSubtitle">Please retry to continue onboarding.</div>
            <InlineError>{props.error}</InlineError>
            <PrimaryButton onClick={props.onStart}>Retry</PrimaryButton>
          </div>
        </GlassCard>
      </HeroPageLayout>
    );
  }

  // If start is neither busy nor errored, we should have navigated away already.
  return <LoadingScreen state={null} />;
}

export function WelcomePage({ state }: { state: Extract<GatewayState, { kind: "ready" }> }) {
  const navigate = useNavigate();
  const onboarded = useAppSelector((s) => s.onboarding.onboarded);
  const welcome = useWelcomeState({ state, navigate });

  React.useEffect(() => {
    if (onboarded) {
      navigate("/chat", { replace: true });
    }
  }, [navigate, onboarded]);

  return (
    <Routes>
      <Route
        index
        element={
          <WelcomeAutoStart
            startBusy={welcome.startBusy}
            error={welcome.error}
            onStart={() => {
              void welcome.start();
            }}
          />
        }
      />

      <Route
        path="provider-select"
        element={<ProviderSelectPage error={welcome.error} onSelect={welcome.onProviderSelect} />}
      />

      <Route
        path="api-key"
        element={
          welcome.selectedProvider ? (
            <ApiKeyPage
              provider={welcome.selectedProvider}
              status={welcome.status}
              error={welcome.error}
              busy={welcome.apiKeyBusy}
              onSubmit={welcome.onApiKeySubmit}
              onBack={welcome.goProviderSelect}
            />
          ) : (
            <Navigate to={`${routes.welcome}/provider-select`} replace />
          )
        }
      />

      <Route
        path="model-select"
        element={
          <ModelSelectPage
            models={welcome.models}
            filterProvider={welcome.selectedProvider ?? undefined}
            loading={welcome.modelsLoading}
            error={welcome.modelsError}
            onSelect={(modelId) => void welcome.onModelSelect(modelId)}
            onBack={welcome.goApiKey}
            onRetry={() => void welcome.loadModels()}
          />
        }
      />

      <Route
        path="skills"
        element={
          <SkillsSetupPage
            googleWorkspaceStatus={welcome.skills["google-workspace"]}
            onGoogleWorkspaceConnect={welcome.goGogGoogleWorkspace}
            onBack={welcome.goModelSelect}
            onSkip={welcome.goTelegramToken}
            onContinue={welcome.goTelegramToken}
          />
        }
      />

      <Route
        path="telegram-token"
        element={
          <TelegramTokenPage
            status={welcome.status}
            error={welcome.error}
            telegramToken={welcome.telegramToken}
            setTelegramToken={welcome.setTelegramToken}
            onNext={() => void welcome.onTelegramTokenNext()}
            onSkip={() => void welcome.goGog()}
          />
        }
      />

      <Route
        path="telegram-user"
        element={
          <TelegramUserPage
            status={welcome.status}
            error={welcome.error}
            telegramUserId={welcome.telegramUserId}
            setTelegramUserId={welcome.setTelegramUserId}
            channelsProbe={welcome.channelsProbe}
            onNext={() => void welcome.onTelegramUserNext()}
            onSkip={() => void welcome.goGog()}
          />
        }
      />

      <Route
        path="gog"
        element={
          <GogPage
            status={welcome.status}
            error={welcome.error}
            gogBusy={welcome.gogBusy}
            gogError={welcome.gogError}
            gogOutput={welcome.gogOutput}
            gogAccount={welcome.gogAccount}
            setGogAccount={welcome.setGogAccount}
            onRunAuthAdd={(servicesCsv) => welcome.onGogAuthAdd(servicesCsv)}
            onRunAuthList={() => welcome.onGogAuthList()}
            onFinish={() => welcome.finish()}
          />
        }
      />

      <Route
        path="gog-google-workspace"
        element={
          <GogPage
            status={welcome.status}
            error={welcome.error}
            gogBusy={welcome.gogBusy}
            gogError={welcome.gogError}
            gogOutput={welcome.gogOutput}
            gogAccount={welcome.gogAccount}
            setGogAccount={welcome.setGogAccount}
            onRunAuthAdd={async (servicesCsv) => {
              const res = await welcome.onGogAuthAdd(servicesCsv);
              if (res.ok) {
                welcome.markSkillConnected("google-workspace");
                welcome.goSkills();
              }
              return res;
            }}
            onRunAuthList={() => welcome.onGogAuthList()}
            onFinish={welcome.goSkills}
            onSkip={welcome.goSkills}
            finishText="Back to skills"
            skipText="Back"
          />
        }
      />

      <Route path="*" element={<Navigate to={routes.welcome} replace />} />
    </Routes>
  );
}

