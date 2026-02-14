/**
 * Tests for configParsing utilities.
 */
import { describe, expect, it } from "vitest";

import { getDefaultModelPrimary, getConfiguredProviders } from "./configParsing";

// ── getDefaultModelPrimary ─────────────────────────────────────────────────────

describe("getDefaultModelPrimary", () => {
  it("returns null for undefined", () => {
    expect(getDefaultModelPrimary(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(getDefaultModelPrimary(null as never)).toBeNull();
  });

  it("returns null for an array", () => {
    expect(getDefaultModelPrimary([] as never)).toBeNull();
  });

  it("returns null for a non-object", () => {
    expect(getDefaultModelPrimary("string" as never)).toBeNull();
    expect(getDefaultModelPrimary(42 as never)).toBeNull();
  });

  it("extracts string from cfg.agents.defaults.model.primary", () => {
    const cfg = { agents: { defaults: { model: { primary: "anthropic/claude-3" } } } };
    expect(getDefaultModelPrimary(cfg)).toBe("anthropic/claude-3");
  });

  it("trims whitespace from the primary value", () => {
    const cfg = { agents: { defaults: { model: { primary: "  openai/gpt-4  " } } } };
    expect(getDefaultModelPrimary(cfg)).toBe("openai/gpt-4");
  });

  it("returns null if primary is empty string", () => {
    const cfg = { agents: { defaults: { model: { primary: "" } } } };
    expect(getDefaultModelPrimary(cfg)).toBeNull();
  });

  it("returns null if primary is whitespace only", () => {
    const cfg = { agents: { defaults: { model: { primary: "   " } } } };
    expect(getDefaultModelPrimary(cfg)).toBeNull();
  });

  it("returns null if agents path is missing", () => {
    expect(getDefaultModelPrimary({})).toBeNull();
    expect(getDefaultModelPrimary({ agents: {} })).toBeNull();
    expect(getDefaultModelPrimary({ agents: { defaults: {} } })).toBeNull();
    expect(getDefaultModelPrimary({ agents: { defaults: { model: {} } } })).toBeNull();
  });

  it("returns null if primary is not a string", () => {
    const cfg = { agents: { defaults: { model: { primary: 42 } } } };
    expect(getDefaultModelPrimary(cfg)).toBeNull();
  });
});

// ── getConfiguredProviders ─────────────────────────────────────────────────────

describe("getConfiguredProviders", () => {
  it("returns empty set for undefined", () => {
    expect(getConfiguredProviders(undefined)).toEqual(new Set());
  });

  it("returns empty set for null", () => {
    expect(getConfiguredProviders(null as never)).toEqual(new Set());
  });

  it("returns empty set for an array", () => {
    expect(getConfiguredProviders([] as never)).toEqual(new Set());
  });

  it("returns empty set when auth.order is missing", () => {
    expect(getConfiguredProviders({})).toEqual(new Set());
    expect(getConfiguredProviders({ auth: {} })).toEqual(new Set());
  });

  it("returns empty set when auth.order is an array", () => {
    expect(getConfiguredProviders({ auth: { order: ["anthropic"] } })).toEqual(new Set());
  });

  it("extracts valid providers from auth.order", () => {
    const cfg = {
      auth: {
        order: {
          anthropic: ["anthropic:default"],
          openai: ["openai:default"],
        },
      },
    };
    expect(getConfiguredProviders(cfg)).toEqual(new Set(["anthropic", "openai"]));
  });

  it("ignores invalid/unknown provider keys", () => {
    const cfg = {
      auth: {
        order: {
          anthropic: ["anthropic:default"],
          fakeProvider: ["fake:default"],
        },
      },
    };
    expect(getConfiguredProviders(cfg)).toEqual(new Set(["anthropic"]));
  });

  it("skips providers with non-array values", () => {
    const cfg = {
      auth: {
        order: {
          anthropic: "not-an-array",
          openai: ["openai:default"],
        },
      },
    };
    expect(getConfiguredProviders(cfg)).toEqual(new Set(["openai"]));
  });

  it("skips providers with empty arrays", () => {
    const cfg = {
      auth: {
        order: {
          anthropic: [],
          openai: ["openai:default"],
        },
      },
    };
    expect(getConfiguredProviders(cfg)).toEqual(new Set(["openai"]));
  });

  it("skips providers whose array entries are all empty/whitespace strings", () => {
    const cfg = {
      auth: {
        order: {
          anthropic: ["", "  "],
          openai: ["openai:default"],
        },
      },
    };
    expect(getConfiguredProviders(cfg)).toEqual(new Set(["openai"]));
  });

  it("normalizes provider key casing", () => {
    const cfg = {
      auth: {
        order: {
          Anthropic: ["anthropic:default"],
          OPENAI: ["openai:default"],
        },
      },
    };
    expect(getConfiguredProviders(cfg)).toEqual(new Set(["anthropic", "openai"]));
  });

  it("recognizes all valid provider names", () => {
    const cfg = {
      auth: {
        order: {
          anthropic: ["a"],
          openrouter: ["b"],
          google: ["c"],
          openai: ["d"],
          zai: ["e"],
          minimax: ["f"],
        },
      },
    };
    expect(getConfiguredProviders(cfg)).toEqual(
      new Set(["anthropic", "openrouter", "google", "openai", "zai", "minimax"])
    );
  });
});
