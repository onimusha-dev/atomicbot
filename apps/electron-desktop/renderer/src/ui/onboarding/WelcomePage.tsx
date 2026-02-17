import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAppSelector } from "@store/hooks";
import type { GatewayState } from "@main/types";
import { routes } from "../app/routes";
import { GlassCard, HeroPageLayout, PrimaryButton } from "@shared/kit";
import { ApiKeyPage } from "./providers/ApiKeyPage";
import { OAuthProviderPage } from "./providers/OAuthProviderPage";
import { AppleNotesConnectPage } from "./connections/AppleNotesConnectPage";
import { AppleRemindersConnectPage } from "./connections/AppleRemindersConnectPage";
import { GogPage } from "./skills/GogPage";
import { MediaUnderstandingPage } from "./skills/MediaUnderstandingPage";
import { ModelSelectPage } from "./providers/ModelSelectPage";
import { NotionConnectPage } from "./connections/NotionConnectPage";
import { ObsidianConnectPage } from "./connections/ObsidianConnectPage";
import { GitHubConnectPage } from "./connections/GitHubConnectPage";
import { ProviderSelectPage } from "./providers/ProviderSelectPage";
import { ConnectionsSetupPage } from "./connections/ConnectionsSetupPage";
import { SkillsSetupPage } from "./skills/SkillsSetupPage";
import { SlackConnectPage } from "./connections/SlackConnectPage";
import { TrelloConnectPage } from "./connections/TrelloConnectPage";
import { TelegramTokenPage } from "./connections/TelegramTokenPage";
import { TelegramUserPage } from "./connections/TelegramUserPage";
import { WebSearchPage } from "./skills/WebSearchPage";
import { RestoreOptionPage } from "./RestoreOptionPage";
import { RestoreFilePage } from "./RestoreFilePage";
import { useWelcomeState } from "./hooks/useWelcomeState";

function WelcomeAutoStart(props: {
  startBusy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const didStartRef = React.useRef(false);

  React.useEffect(() => {
    if (didStartRef.current) {
      return;
    }
    didStartRef.current = true;
    props.onStart();
  }, [props.onStart]);

  // While config setup is in progress, render nothing visible to avoid a
  // loading-screen flash between consent and provider-select.
  if (props.startBusy) {
    return null;
  }

  if (props.error) {
    return (
      <HeroPageLayout title="WELCOME" variant="compact" align="center" aria-label="Welcome setup">
        <GlassCard className="UiGlassCard-intro">
          <div className="UiIntroInner">
            <div className="UiSectionTitle">Setup failed.</div>
            <div className="UiSectionSubtitle">Please retry to continue onboarding.</div>
            <PrimaryButton onClick={props.onStart}>Retry</PrimaryButton>
          </div>
        </GlassCard>
      </HeroPageLayout>
    );
  }

  // If start is neither busy nor errored, we should have navigated away already.
  return null;
}

export function WelcomePage({ state }: { state: Extract<GatewayState, { kind: "ready" }> }) {
  const navigate = useNavigate();
  const onboarded = useAppSelector((s) => s.onboarding.onboarded);
  const welcome = useWelcomeState({ state, navigate });

  React.useEffect(() => {
    if (onboarded) {
      void navigate("/chat", { replace: true });
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
        element={
          <ProviderSelectPage
            selectedProvider={welcome.selectedProvider}
            error={welcome.error}
            onSelect={welcome.onProviderSelect}
            onBack={() => void navigate(routes.consent)}
          />
        }
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
              onSubmitSetupToken={(token) => void welcome.onSetupTokenSubmit(token)}
              onBack={welcome.goProviderSelect}
            />
          ) : (
            <Navigate to={`${routes.welcome}/provider-select`} replace />
          )
        }
      />

      <Route
        path="oauth-provider"
        element={
          welcome.selectedProvider ? (
            <OAuthProviderPage
              provider={welcome.selectedProvider}
              onSuccess={(profileId) => void welcome.onOAuthSuccess(profileId)}
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
        path="web-search"
        element={
          <WebSearchPage
            status={welcome.status}
            error={welcome.error}
            busy={welcome.webSearchBusy}
            onSubmit={(provider, apiKey) => void welcome.onWebSearchSubmit(provider, apiKey)}
            onBack={welcome.goSkills}
            onSkip={welcome.goSkills}
          />
        }
      />

      <Route
        path="media-understanding"
        element={
          <MediaUnderstandingPage
            status={welcome.status}
            error={welcome.error}
            busy={welcome.mediaUnderstandingBusy}
            hasOpenAiProvider={welcome.hasOpenAiProvider}
            onSubmit={(settings) => void welcome.onMediaUnderstandingSubmit(settings)}
            onAddProviderKey={(provider, apiKey) =>
              welcome.onMediaProviderKeySubmit(provider, apiKey)
            }
            onBack={welcome.goSkills}
            onSkip={welcome.goSkills}
          />
        }
      />

      <Route
        path="skills"
        element={
          <SkillsSetupPage
            googleWorkspaceStatus={welcome.skills["google-workspace"]}
            onGoogleWorkspaceConnect={welcome.goGogGoogleWorkspace}
            mediaUnderstandingStatus={welcome.skills["media-understanding"]}
            onMediaUnderstandingConnect={welcome.goMediaUnderstanding}
            webSearchStatus={welcome.skills["web-search"]}
            onWebSearchConnect={welcome.goWebSearch}
            notionStatus={welcome.skills.notion}
            onNotionConnect={welcome.goNotion}
            trelloStatus={welcome.skills.trello}
            onTrelloConnect={welcome.goTrello}
            appleNotesStatus={welcome.skills["apple-notes"]}
            onAppleNotesConnect={welcome.goAppleNotes}
            appleRemindersStatus={welcome.skills["apple-reminders"]}
            onAppleRemindersConnect={welcome.goAppleReminders}
            obsidianStatus={welcome.skills.obsidian}
            onObsidianConnect={welcome.goObsidian}
            githubStatus={welcome.skills.github}
            onGitHubConnect={welcome.goGitHub}
            slackStatus={welcome.skills.slack}
            onSlackConnect={welcome.goSlackFromSkills}
            onBack={welcome.goModelSelect}
            onSkip={welcome.goConnections}
            onContinue={welcome.goConnections}
          />
        }
      />

      <Route
        path="connections"
        element={
          <ConnectionsSetupPage
            telegramStatus={welcome.telegramStatus}
            onTelegramConnect={welcome.goTelegramToken}
            slackStatus={welcome.skills.slack}
            onSlackConnect={welcome.goSlackFromConnections}
            onBack={welcome.goSkills}
            onSkip={welcome.finish}
            onContinue={welcome.finish}
          />
        }
      />

      <Route
        path="apple-notes"
        element={
          <AppleNotesConnectPage
            status={welcome.status}
            error={welcome.error}
            busy={welcome.appleNotesBusy}
            onCheckAndEnable={() => void welcome.onAppleNotesCheckAndEnable()}
            onBack={welcome.goSkills}
          />
        }
      />

      <Route
        path="apple-reminders"
        element={
          <AppleRemindersConnectPage
            status={welcome.status}
            error={welcome.error}
            busy={welcome.appleRemindersBusy}
            onAuthorizeAndEnable={() => void welcome.onAppleRemindersAuthorizeAndEnable()}
            onBack={welcome.goSkills}
          />
        }
      />

      <Route
        path="obsidian"
        element={
          <ObsidianConnectPage
            status={welcome.status}
            error={welcome.error}
            busy={welcome.obsidianBusy}
            vaults={welcome.obsidianVaults}
            selectedVaultName={welcome.selectedObsidianVaultName}
            setSelectedVaultName={welcome.setSelectedObsidianVaultName}
            vaultsLoading={welcome.obsidianVaultsLoading}
            onSetDefaultAndEnable={(vaultName) =>
              void welcome.onObsidianSetDefaultAndEnable(vaultName)
            }
            onRecheck={() => void welcome.onObsidianRecheck()}
            onBack={welcome.goSkills}
          />
        }
      />

      <Route
        path="github"
        element={
          <GitHubConnectPage
            status={welcome.status}
            error={welcome.error}
            busy={welcome.githubBusy}
            onSubmit={(pat) => void welcome.onGitHubConnect(pat)}
            onBack={welcome.goSkills}
          />
        }
      />

      <Route
        path="slack"
        element={
          <SlackConnectPage
            status={welcome.status}
            error={welcome.error}
            busy={welcome.slackBusy}
            onSubmit={(settings) => void welcome.onSlackConnect(settings)}
            onBack={welcome.goSlackBack}
          />
        }
      />

      <Route
        path="notion"
        element={
          <NotionConnectPage
            status={welcome.status}
            error={welcome.error}
            busy={welcome.notionBusy}
            onSubmit={(apiKey) => void welcome.onNotionApiKeySubmit(apiKey)}
            onBack={welcome.goSkills}
          />
        }
      />

      <Route
        path="trello"
        element={
          <TrelloConnectPage
            status={welcome.status}
            error={welcome.error}
            busy={welcome.trelloBusy}
            onSubmit={(apiKey, token) => void welcome.onTrelloSubmit(apiKey, token)}
            onBack={welcome.goSkills}
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
            onSkip={welcome.goConnections}
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
            onSkip={welcome.goConnections}
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
            skipText="Back"
          />
        }
      />

      <Route path="restore" element={<RestoreOptionPage />} />
      <Route path="restore-file" element={<RestoreFilePage />} />

      <Route path="*" element={<Navigate to={routes.welcome} replace />} />
    </Routes>
  );
}
