/**
 * Tests for auth profiles storage: read, write, and path resolution.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  resolveAuthProfilesPath,
  readAuthProfilesStore,
  writeAuthProfilesStoreAtomic,
} from "./authProfilesStore";

describe("resolveAuthProfilesPath", () => {
  it("returns correct path under stateDir with default agent", () => {
    const result = resolveAuthProfilesPath({ stateDir: "/state" });
    expect(result).toBe(path.join("/state", "agents", "main", "agent", "auth-profiles.json"));
  });

  it("uses custom agentId when provided", () => {
    const result = resolveAuthProfilesPath({ stateDir: "/state", agentId: "custom" });
    expect(result).toBe(path.join("/state", "agents", "custom", "agent", "auth-profiles.json"));
  });
});

describe("readAuthProfilesStore", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "auth-profiles-test-"));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns default store when file does not exist", () => {
    const result = readAuthProfilesStore({
      authProfilesPath: path.join(tmpDir, "nonexistent.json"),
    });
    expect(result.version).toBe(1);
    expect(result.profiles).toEqual({});
    expect(result.order).toEqual({});
  });

  it("parses valid store from file", () => {
    const store = {
      version: 2,
      profiles: {
        p1: { type: "api_key", provider: "anthropic", key: "sk-test" },
      },
      order: {
        anthropic: ["p1"],
      },
    };
    const filePath = path.join(tmpDir, "profiles.json");
    fs.writeFileSync(filePath, JSON.stringify(store));
    const result = readAuthProfilesStore({ authProfilesPath: filePath });
    expect(result.version).toBe(2);
    expect(result.profiles.p1).toEqual({
      type: "api_key",
      provider: "anthropic",
      key: "sk-test",
    });
    expect(result.order.anthropic).toEqual(["p1"]);
  });

  it("returns default for malformed JSON", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, "not valid json {{{");
    const result = readAuthProfilesStore({ authProfilesPath: filePath });
    expect(result.version).toBe(1);
    expect(result.profiles).toEqual({});
  });

  it("skips profiles with missing provider or key", () => {
    const store = {
      version: 1,
      profiles: {
        good: { type: "api_key", provider: "openai", key: "sk-ok" },
        bad1: { type: "api_key", provider: "", key: "sk-test" },
        bad2: { type: "api_key", provider: "openai", key: "" },
        bad3: { type: "other_type", provider: "openai", key: "key" },
      },
      order: {},
    };
    const filePath = path.join(tmpDir, "partial.json");
    fs.writeFileSync(filePath, JSON.stringify(store));
    const result = readAuthProfilesStore({ authProfilesPath: filePath });
    expect(Object.keys(result.profiles)).toEqual(["good"]);
  });
});

describe("writeAuthProfilesStoreAtomic", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "auth-write-test-"));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes and can be read back", () => {
    const filePath = path.join(tmpDir, "sub", "profiles.json");
    const store = {
      version: 1,
      profiles: { p1: { type: "api_key" as const, provider: "anthropic", key: "sk-123" } },
      order: { anthropic: ["p1"] },
    };
    writeAuthProfilesStoreAtomic({ authProfilesPath: filePath, store });
    const result = readAuthProfilesStore({ authProfilesPath: filePath });
    expect(result.profiles.p1).toEqual(store.profiles.p1);
  });
});
