import React from "react";

import { GlassCard, HeroPageLayout, InlineError, PrimaryButton } from "../kit";

export type ModelEntry = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

type ModelTier = "ultra" | "pro" | "fast";

// Exact model IDs for each tier - only these specific models get badges
// (except OpenRouter and Google, which can be name/ID matched to handle dynamic IDs).
const MODEL_TIERS: Record<string, Record<ModelTier, string>> = {
  anthropic: {
    ultra: "claude-opus-4-5",
    pro: "claude-sonnet-4-5",
    fast: "claude-haiku-4-5",
  },
  google: {
    ultra: "gemini-2.5-pro",
    pro: "gemini-2.5-flash",
    fast: "gemini-3-flash-preview",
  },
  openai: {
    ultra: "gpt-5.2-pro",
    pro: "gpt-5.2",
    fast: "gpt-5-mini",
  },
  openrouter: {
    ultra: "",
    pro: "",
    fast: "",
  },
};

const TIER_INFO: Record<ModelTier, { label: string; description: string }> = {
  ultra: { label: "Ultra", description: "Most capable. Best for complex reasoning, analysis, and creative tasks. Highest cost." },
  pro: { label: "Pro", description: "Balanced. Great for coding, writing, and everyday tasks. Moderate cost." },
  fast: { label: "Fast", description: "Quickest responses. Ideal for simple tasks and high-volume use. Lowest cost." },
};

const TIER_ORDER: ModelTier[] = ["ultra", "pro", "fast"];
const TIER_PRIORITY: Record<ModelTier, number> = { ultra: 0, pro: 1, fast: 2 };

function normalizeTierMatchText(text: string): string {
  return text.toLowerCase().replaceAll(/[\s_-]+/g, " ").trim();
}

function getModelTier(model: ModelEntry): ModelTier | null {
  const providerTiers = MODEL_TIERS[model.provider];
  if (!providerTiers) return null;

  const haystack = normalizeTierMatchText(`${model.id} ${model.name}`);

  if (model.provider === "openrouter") {
    // OpenRouter model IDs can vary by sub-provider; match by stable name/ID fragments.
    if (haystack.includes("trinity large preview")) return "ultra";
    if (haystack.includes("kimi") && (haystack.includes("2.5") || haystack.includes("k2.5"))) return "pro";
    // OpenRouter can prefix IDs with sub-provider (e.g. "google/gemini-3-flash-preview").
    if (haystack.includes("gemini 3 flash") && haystack.includes("preview")) return "fast";
  }

  if (model.provider === "google") {
    // "Gemini 3 Flash Preview" should always show as FAST, even if the UI name varies slightly.
    if (haystack.includes("gemini 3 flash") && haystack.includes("preview")) return "fast";
  }

  for (const tier of TIER_ORDER) {
    const exactId = providerTiers[tier];
    if (exactId && model.id === exactId) {
      return tier;
    }
  }
  return null;
}

function formatContextWindow(ctx: number | undefined): string {
  if (!ctx) return "";
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}K`;
  return String(ctx);
}

function formatModelMeta(model: ModelEntry): string | null {
  const parts: string[] = [];
  if (model.contextWindow) parts.push(`ctx ${formatContextWindow(model.contextWindow)}`);
  if (model.reasoning) parts.push("reasoning");
  return parts.length ? parts.join(" · ") : null;
}

export function ModelSelectPage(props: {
  models: ModelEntry[];
  filterProvider?: string;
  loading: boolean;
  error: string | null;
  onSelect: (modelId: string) => void;
  onBack: () => void;
  onRetry: () => void;
}) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const totalSteps = 5;
  const activeStep = 2;

  // Filter and sort models by provider and tier
  const filteredModels = React.useMemo(() => {
    let models = props.models;
    if (props.filterProvider) {
      models = models.filter((m) => m.provider === props.filterProvider);
    }

    // Sort: tiered models first (ultra → pro → fast), then the rest alphabetically
    return models.slice().sort((a: ModelEntry, b: ModelEntry) => {
      const tierA = getModelTier(a);
      const tierB = getModelTier(b);

      // Both have tiers - sort by tier priority
      if (tierA && tierB) {
        return TIER_PRIORITY[tierA] - TIER_PRIORITY[tierB];
      }
      // Only A has tier - A comes first
      if (tierA) return -1;
      // Only B has tier - B comes first
      if (tierB) return 1;
      // Neither has tier - sort alphabetically by name
      return (a.name || a.id).localeCompare(b.name || b.id);
    });
  }, [props.models, props.filterProvider]);

  if (props.loading) {
    return (
      <HeroPageLayout variant="compact" align="center" aria-label="Model selection">
        <GlassCard className="UiModelCard">
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
          <div className="UiSectionTitle">Select AI Model</div>
          <div className="UiSectionSubtitle">Fetching available models from your configured provider.</div>
        </GlassCard>
      </HeroPageLayout>
    );
  }

  if (props.error) {
    return (
      <HeroPageLayout variant="compact" align="center" aria-label="Model selection">
        <GlassCard className="UiModelCard">
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
          <div className="UiSectionTitle">Select AI Model</div>
          <div className="UiSectionSubtitle">Failed to load models.</div>
          <InlineError>{props.error}</InlineError>
          <div className="UiModelBottomRow">
            <button className="UiTextButton" onClick={props.onBack}>
              Back
            </button>
            <PrimaryButton onClick={props.onRetry}>Retry</PrimaryButton>
          </div>
        </GlassCard>
      </HeroPageLayout>
    );
  }

  if (filteredModels.length === 0) {
    return (
      <HeroPageLayout variant="compact" align="center" aria-label="Model selection">
        <GlassCard className="UiModelCard">
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
          <div className="UiSectionTitle">Select AI Model</div>
          <div className="UiSectionSubtitle">
            No models were found for your configured API key. The key may be invalid or the provider may be temporarily
            unavailable.
          </div>
          <div className="UiModelBottomRow">
            <button className="UiTextButton" onClick={props.onBack}>
              Back
            </button>
            <PrimaryButton onClick={props.onRetry}>Retry</PrimaryButton>
          </div>
        </GlassCard>
      </HeroPageLayout>
    );
  }

  return (
    <HeroPageLayout variant="compact" align="center" aria-label="Model selection">
      <GlassCard className="UiModelCard">
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
        <div className="UiSectionTitle">Select AI Model</div>
        <div className="UiSectionSubtitle">Choose your preferred model. You can change this later in settings.</div>
        <div className="UiModelList">
          {filteredModels.map((model) => {
            const modelKey = `${model.provider}/${model.id}`;
            const tier = getModelTier(model);
            const meta = formatModelMeta(model);
            return (
              <label
                key={modelKey}
                className={`UiModelOption ${selected === modelKey ? "UiModelOption--selected" : ""}`}
              >
                <input
                  type="radio"
                  name="model"
                  value={modelKey}
                  checked={selected === modelKey}
                  onChange={() => setSelected(modelKey)}
                  className="UiModelRadio"
                />
                <div className="UiModelContent">
                  <div className="UiModelNameRow">
                    <span className="UiModelName">{model.name || model.id}</span>
                    {tier ? (
                      <span className={`UiModelTierBadge UiModelTierBadge--${tier}`}>{TIER_INFO[tier].label}</span>
                    ) : null}
                  </div>
                  {meta ? <div className="UiModelMeta">{meta}</div> : null}
                </div>
              </label>
            );
          })}
        </div>
        <div className="UiModelBottomRow">
          <button className="UiTextButton" onClick={props.onBack}>
            Back
          </button>
          <PrimaryButton disabled={!selected} onClick={() => selected && props.onSelect(selected)}>
            Continue
          </PrimaryButton>
        </div>
      </GlassCard>
    </HeroPageLayout>
  );
}
