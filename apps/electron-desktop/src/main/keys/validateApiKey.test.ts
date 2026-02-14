/**
 * Tests for API key validation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateProviderApiKey } from "./validateApiKey";

describe("validateProviderApiKey", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns valid for unknown provider (skip validation)", async () => {
    const result = await validateProviderApiKey("custom-provider", "key123");
    expect(result).toEqual({ valid: true });
    // fetch should not be called for unknown providers
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns invalid when provider is empty", async () => {
    const result = await validateProviderApiKey("", "key");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Provider");
  });

  it("returns invalid when API key is empty", async () => {
    const result = await validateProviderApiKey("anthropic", "");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("API key");
  });

  it("returns valid for anthropic when API responds 200", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const result = await validateProviderApiKey("anthropic", "sk-test");
    expect(result).toEqual({ valid: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "x-api-key": "sk-test" }),
      })
    );
  });

  it("returns invalid for 401 response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const result = await validateProviderApiKey("openai", "bad-key");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid API key");
  });

  it("returns invalid for 403 response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    const result = await validateProviderApiKey("anthropic", "forbidden-key");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid API key");
  });

  it("reports server errors (500) without blocking", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const result = await validateProviderApiKey("openai", "key");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("HTTP 500");
  });

  it("handles network errors gracefully", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network failure"));

    const result = await validateProviderApiKey("anthropic", "key");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Network failure");
  });

  it("builds correct URL for google provider", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    await validateProviderApiKey("google", "goog-key");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com"),
      expect.anything()
    );
  });
});
