// @vitest-environment jsdom
/**
 * Tests for the desktopApi wrapper — getDesktopApi, getDesktopApiOrNull,
 * isDesktopApiAvailable.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { getDesktopApi, getDesktopApiOrNull, isDesktopApiAvailable } from "./desktopApi";

// Minimal stub that satisfies the DesktopApi shape for testing purposes.
const STUB_API = { version: "0.0.0-test" } as unknown as NonNullable<Window["openclawDesktop"]>;

describe("desktopApi", () => {
  let originalApi: Window["openclawDesktop"];

  beforeEach(() => {
    originalApi = window.openclawDesktop;
  });

  afterEach(() => {
    // Restore whatever was there before.
    (window as Record<string, unknown>).openclawDesktop = originalApi;
  });

  // ---------- getDesktopApi ----------

  describe("getDesktopApi", () => {
    it("returns the API when available", () => {
      (window as Record<string, unknown>).openclawDesktop = STUB_API;
      expect(getDesktopApi()).toBe(STUB_API);
    });

    it("throws when the API is undefined", () => {
      (window as Record<string, unknown>).openclawDesktop = undefined;
      expect(() => getDesktopApi()).toThrow("Desktop API not available");
    });
  });

  // ---------- getDesktopApiOrNull ----------

  describe("getDesktopApiOrNull", () => {
    it("returns the API when available", () => {
      (window as Record<string, unknown>).openclawDesktop = STUB_API;
      expect(getDesktopApiOrNull()).toBe(STUB_API);
    });

    it("returns null when the API is undefined", () => {
      (window as Record<string, unknown>).openclawDesktop = undefined;
      expect(getDesktopApiOrNull()).toBeNull();
    });
  });

  // ---------- isDesktopApiAvailable ----------

  describe("isDesktopApiAvailable", () => {
    it("returns true when the API is present", () => {
      (window as Record<string, unknown>).openclawDesktop = STUB_API;
      expect(isDesktopApiAvailable()).toBe(true);
    });

    it("returns false when the API is undefined", () => {
      (window as Record<string, unknown>).openclawDesktop = undefined;
      expect(isDesktopApiAvailable()).toBe(false);
    });

    it("returns false when the API is null", () => {
      (window as Record<string, unknown>).openclawDesktop = null as unknown as undefined;
      expect(isDesktopApiAvailable()).toBe(false);
    });
  });
});
