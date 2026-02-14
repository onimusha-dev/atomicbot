/**
 * Tests for gateway config reading and creation.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readGatewayTokenFromConfig, ensureGatewayConfigFile } from "./config";

describe("readGatewayTokenFromConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "gw-config-test-"));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null for missing config file", () => {
    const result = readGatewayTokenFromConfig(path.join(tmpDir, "nope.json"));
    expect(result).toBeNull();
  });

  it("returns token from valid config", () => {
    const configPath = path.join(tmpDir, "openclaw.json");
    const config = {
      gateway: {
        auth: {
          token: "test-token-123",
        },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(config));
    expect(readGatewayTokenFromConfig(configPath)).toBe("test-token-123");
  });

  it("returns null when token is empty", () => {
    const configPath = path.join(tmpDir, "openclaw.json");
    const config = { gateway: { auth: { token: "   " } } };
    fs.writeFileSync(configPath, JSON.stringify(config));
    expect(readGatewayTokenFromConfig(configPath)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const configPath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(configPath, "not json");
    expect(readGatewayTokenFromConfig(configPath)).toBeNull();
  });

  it("returns null when gateway section is missing", () => {
    const configPath = path.join(tmpDir, "openclaw.json");
    fs.writeFileSync(configPath, JSON.stringify({ other: "stuff" }));
    expect(readGatewayTokenFromConfig(configPath)).toBeNull();
  });
});

describe("ensureGatewayConfigFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "gw-ensure-test-"));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates config file with token when it does not exist", () => {
    const configPath = path.join(tmpDir, "new-config.json");
    ensureGatewayConfigFile({ configPath, token: "my-token" });

    expect(fs.existsSync(configPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(content.gateway.auth.token).toBe("my-token");
    expect(content.gateway.controlUi.allowedOrigins).toContain("null");
    expect(content.gateway.mode).toBe("local");
    expect(content.gateway.bind).toBe("loopback");
  });

  it("patches existing config to add null origin", () => {
    const configPath = path.join(tmpDir, "existing.json");
    const existing = {
      gateway: {
        mode: "local",
        bind: "loopback",
        auth: { mode: "token", token: "existing-token" },
        controlUi: { allowedOrigins: ["http://localhost:3000"] },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(existing));

    ensureGatewayConfigFile({ configPath, token: "new-token" });

    const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(content.gateway.controlUi.allowedOrigins).toContain("null");
    expect(content.gateway.controlUi.allowedOrigins).toContain("http://localhost:3000");
  });

  it("does not patch if null already in allowedOrigins", () => {
    const configPath = path.join(tmpDir, "already-patched.json");
    const existing = {
      gateway: {
        mode: "local",
        bind: "loopback",
        auth: { mode: "token", token: "tok" },
        controlUi: { allowedOrigins: ["null"] },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
    const before = fs.readFileSync(configPath, "utf-8");

    ensureGatewayConfigFile({ configPath, token: "tok" });

    const after = fs.readFileSync(configPath, "utf-8");
    // File should not be modified
    expect(after).toBe(before);
  });
});
