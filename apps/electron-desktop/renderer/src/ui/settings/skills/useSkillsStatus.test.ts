/**
 * Tests for useSkillsStatus – disableSkill function.
 */
import { describe, expect, it, vi } from "vitest";

import { disableSkill, type SkillId } from "./useSkillsStatus";

function mockGw() {
  return { request: vi.fn().mockResolvedValue({}) };
}

function mockLoadConfig(hash: string | undefined) {
  return vi.fn().mockResolvedValue({ hash, config: {} });
}

// ── disableSkill: skills.update path (SKILLS_ENTRY_KEYS) ──────────────────────

describe("disableSkill – skills.update path", () => {
  it.each<[SkillId, string]>([
    ["notion", "notion"],
    ["trello", "trello"],
    ["apple-notes", "apple-notes"],
    ["apple-reminders", "apple-reminders"],
    ["obsidian", "obsidian"],
    ["github", "github"],
    ["google-workspace", "gog"],
  ])("calls skills.update for %s with skillKey=%s", async (skillId, expectedKey) => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("hash");

    await disableSkill(gw, loadConfig, skillId);

    expect(gw.request).toHaveBeenCalledOnce();
    expect(gw.request).toHaveBeenCalledWith("skills.update", {
      skillKey: expectedKey,
      enabled: false,
    });
    // loadConfig should NOT be called for skills.update path.
    expect(loadConfig).not.toHaveBeenCalled();
  });
});

// ── disableSkill: config.patch path ────────────────────────────────────────────

describe("disableSkill – config.patch path", () => {
  it("disables media-understanding via config.patch", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("baseH");

    await disableSkill(gw, loadConfig, "media-understanding");

    expect(loadConfig).toHaveBeenCalledOnce();
    expect(gw.request).toHaveBeenCalledOnce();
    expect(gw.request).toHaveBeenCalledWith("config.patch", {
      baseHash: "baseH",
      raw: JSON.stringify({
        tools: {
          media: {
            image: { enabled: false },
            audio: { enabled: false },
            video: { enabled: false },
          },
        },
      }),
      note: "Settings: disable media understanding",
    });
  });

  it("disables web-search via config.patch", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("wHash");

    await disableSkill(gw, loadConfig, "web-search");

    expect(loadConfig).toHaveBeenCalledOnce();
    expect(gw.request).toHaveBeenCalledOnce();
    expect(gw.request).toHaveBeenCalledWith("config.patch", {
      baseHash: "wHash",
      raw: JSON.stringify({ tools: { web: { search: { enabled: false } } } }),
      note: "Settings: disable web search",
    });
  });

  it("disables slack via config.patch", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("sHash");

    await disableSkill(gw, loadConfig, "slack");

    expect(loadConfig).toHaveBeenCalledOnce();
    expect(gw.request).toHaveBeenCalledOnce();
    expect(gw.request).toHaveBeenCalledWith("config.patch", {
      baseHash: "sHash",
      raw: JSON.stringify({ channels: { slack: { enabled: false } } }),
      note: "Settings: disable Slack",
    });
  });

  it("throws if baseHash is missing for media-understanding", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig(undefined);

    await expect(disableSkill(gw, loadConfig, "media-understanding")).rejects.toThrow(
      "Config base hash missing"
    );
    expect(gw.request).not.toHaveBeenCalled();
  });

  it("throws if baseHash is empty string for web-search", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("");

    await expect(disableSkill(gw, loadConfig, "web-search")).rejects.toThrow(
      "Config base hash missing"
    );
    expect(gw.request).not.toHaveBeenCalled();
  });

  it("throws if baseHash is whitespace only for slack", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("   ");

    await expect(disableSkill(gw, loadConfig, "slack")).rejects.toThrow(
      "Config base hash missing"
    );
    expect(gw.request).not.toHaveBeenCalled();
  });
});
