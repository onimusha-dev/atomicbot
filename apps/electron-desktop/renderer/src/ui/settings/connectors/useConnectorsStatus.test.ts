/**
 * Tests for useConnectorsStatus – disableConnector function.
 */
import { describe, expect, it, vi } from "vitest";

import { disableConnector, type ConnectorId } from "./useConnectorsStatus";

function mockGw() {
  return { request: vi.fn().mockResolvedValue({}) };
}

function mockLoadConfig(hash: string | undefined) {
  return vi.fn().mockResolvedValue({ hash, config: {} });
}

// ── disableConnector ───────────────────────────────────────────────────────────

describe("disableConnector", () => {
  it("calls gw.request with correct config.patch payload for telegram", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("abc123");

    await disableConnector(gw, loadConfig, "telegram");

    expect(loadConfig).toHaveBeenCalledOnce();
    expect(gw.request).toHaveBeenCalledOnce();
    expect(gw.request).toHaveBeenCalledWith("config.patch", {
      baseHash: "abc123",
      raw: JSON.stringify(
        {
          channels: { telegram: { enabled: false } },
          plugins: { entries: { telegram: { enabled: false } } },
        },
        null,
        2
      ),
      note: "Settings: disable telegram",
    });
  });

  it("calls gw.request with correct payload for slack", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("hash456");

    await disableConnector(gw, loadConfig, "slack");

    expect(gw.request).toHaveBeenCalledWith("config.patch", {
      baseHash: "hash456",
      raw: JSON.stringify(
        {
          channels: { slack: { enabled: false } },
          plugins: { entries: { slack: { enabled: false } } },
        },
        null,
        2
      ),
      note: "Settings: disable slack",
    });
  });

  it("calls gw.request with correct payload for imessage", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("hash789");

    await disableConnector(gw, loadConfig, "imessage");

    expect(gw.request).toHaveBeenCalledWith("config.patch", {
      baseHash: "hash789",
      raw: JSON.stringify(
        {
          channels: { imessage: { enabled: false } },
          plugins: { entries: { imessage: { enabled: false } } },
        },
        null,
        2
      ),
      note: "Settings: disable imessage",
    });
  });

  it.each<ConnectorId>(["telegram", "discord", "whatsapp", "signal", "slack", "matrix", "msteams"])(
    "uses connectorId as channel key for %s",
    async (id) => {
      const gw = mockGw();
      const loadConfig = mockLoadConfig("h1");

      await disableConnector(gw, loadConfig, id);

      const call = gw.request.mock.calls[0];
      const payload = call?.[1] as { raw: string };
      const parsed = JSON.parse(payload.raw);
      expect(parsed.channels).toHaveProperty(id);
      expect(parsed.plugins.entries).toHaveProperty(id);
    }
  );

  it("throws if baseHash is missing (undefined)", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig(undefined);

    await expect(disableConnector(gw, loadConfig, "telegram")).rejects.toThrow(
      "Config base hash missing"
    );
    expect(gw.request).not.toHaveBeenCalled();
  });

  it("throws if baseHash is empty string", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("");

    await expect(disableConnector(gw, loadConfig, "telegram")).rejects.toThrow(
      "Config base hash missing"
    );
    expect(gw.request).not.toHaveBeenCalled();
  });

  it("throws if baseHash is whitespace only", async () => {
    const gw = mockGw();
    const loadConfig = mockLoadConfig("   ");

    await expect(disableConnector(gw, loadConfig, "telegram")).rejects.toThrow(
      "Config base hash missing"
    );
    expect(gw.request).not.toHaveBeenCalled();
  });
});
