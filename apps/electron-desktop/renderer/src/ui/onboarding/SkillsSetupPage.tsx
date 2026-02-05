import React from "react";

import { GlassCard, HeroPageLayout, PrimaryButton, SecondaryButton } from "../kit";

type SkillStatus = "connect" | "connected" | "coming-soon";

type SkillEntry = {
  id: string;
  name: string;
  description: string;
  status: SkillStatus;
  iconText: string;
  iconVariant: "google" | "notion" | "trello" | "gemini" | "nano-banana" | "sag";
};

const SKILLS: SkillEntry[] = [
  {
    id: "google-workspace",
    name: "Google Workspace",
    description: "Clears your inbox, sends emails, and manages your calendar",
    status: "connect",
    iconText: "G",
    iconVariant: "google",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Create, search, update and organize your notes, docs, and knowledge base",
    status: "connect",
    iconText: "N",
    iconVariant: "notion",
  },
  {
    id: "trello",
    name: "Trello",
    description: "Track tasks, update boards and manage projects without opening Trello",
    status: "connect",
    iconText: "T",
    iconVariant: "trello",
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "Interact with Google's Gemini models and experiment with powerful multimodal AI",
    status: "connect",
    iconText: "✦",
    iconVariant: "gemini",
  },
  {
    id: "nano-banana",
    name: "Nano Banana",
    description: "Generate high-quality images with modern image models",
    status: "connect",
    iconText: "NB",
    iconVariant: "nano-banana",
  },
  {
    id: "sag",
    name: "Sag",
    description: "Elevate your text-to-speech tool",
    status: "coming-soon",
    iconText: "Ⅱ",
    iconVariant: "sag",
  },
];

function SkillCta({ status, onConnect }: { status: SkillStatus; onConnect?: () => void }) {
  if (status === "connected") {
    return (
      <span className="UiSkillStatus UiSkillStatus--connected" aria-label="Connected">
        ✓ Connected
      </span>
    );
  }
  if (status === "coming-soon") {
    return (
      <span className="UiSkillStatus UiSkillStatus--soon" aria-label="Coming soon">
        Coming Soon
      </span>
    );
  }
  return (
    <button
      className="UiSkillConnectButton"
      type="button"
      disabled={!onConnect}
      title={onConnect ? "Connect" : "Not available yet"}
      onClick={onConnect}
    >
      Connect
    </button>
  );
}

export function SkillsSetupPage(props: {
  googleWorkspaceStatus: Exclude<SkillStatus, "coming-soon">;
  onGoogleWorkspaceConnect: () => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const totalSteps = 5;
  const activeStep = 3;
  return (
    <HeroPageLayout variant="compact" align="center" aria-label="Skills setup">
      <GlassCard className="UiSkillsCard">
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
        <div className="UiSectionTitle">Set Up Skills</div>
        <div className="UiSectionSubtitle">Set up integrations to solve more tasks or do it later</div>

        <div className="UiSkillsScroll">
          <div className="UiSkillsGrid">
            {SKILLS.map((skill) => {
              const status = skill.id === "google-workspace" ? props.googleWorkspaceStatus : skill.status;
              const onConnect = skill.id === "google-workspace" ? props.onGoogleWorkspaceConnect : undefined;
              const connected = status === "connected";
              return (
                <div
                  key={skill.id}
                  className={`UiSkillCard${connected ? " UiSkillCard--connected" : ""}`}
                  role="group"
                  aria-label={skill.name}
                >
                <div className="UiSkillTopRow">
                  <span className={`UiSkillIcon UiSkillIcon--${skill.iconVariant}`} aria-hidden="true">
                    {skill.iconText}
                  </span>
                  <div className="UiSkillTopRight">
                    <SkillCta status={status} onConnect={onConnect} />
                  </div>
                </div>
                <div className="UiSkillName">{skill.name}</div>
                <div className="UiSkillDescription">{skill.description}</div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="UiSkillsBottomRow">
          <button className="UiTextButton" onClick={props.onBack} type="button">
            Back
          </button>
          <div className="UiSkillsBottomActions">
            <SecondaryButton onClick={props.onSkip}>Skip</SecondaryButton>
            <PrimaryButton onClick={props.onContinue}>Continue</PrimaryButton>
          </div>
        </div>
      </GlassCard>
    </HeroPageLayout>
  );
}

