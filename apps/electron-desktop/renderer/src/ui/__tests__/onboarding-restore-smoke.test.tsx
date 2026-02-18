// @vitest-environment jsdom
/**
 * Smoke tests for the restore flow onboarding pages:
 * RestoreOptionPage and RestoreFilePage.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before component imports (vitest hoists).
// ---------------------------------------------------------------------------

const stableRequest = vi.fn(() => Promise.resolve({}));
const stableOnEvent = vi.fn(() => () => {});

vi.mock("../../gateway/context", () => ({
  useGatewayRpc: vi.fn(() => ({
    client: {},
    connected: true,
    request: stableRequest,
    onEvent: stableOnEvent,
  })),
  GatewayRpcProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { RestoreOptionPage } from "../onboarding/RestoreOptionPage";
import { RestoreFilePage } from "../onboarding/RestoreFilePage";
import { TestShell, expectRendered } from "./helpers/onboarding-test-helpers";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Restore flow smoke tests", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    (window as Record<string, unknown>).openclawDesktop = {
      getConsentInfo: vi.fn(() => Promise.resolve({ accepted: true })),
      openExternal: vi.fn(),
      detectLocalOpenclaw: vi.fn(() => Promise.resolve({ found: false, path: "" })),
      restoreFromDirectory: vi.fn(() => Promise.resolve({ ok: true })),
      selectOpenclawFolder: vi.fn(() => Promise.resolve({ ok: false, cancelled: true })),
      restoreBackup: vi.fn(() => Promise.resolve({ ok: true })),
    };
  });

  // -- RestoreOptionPage --

  it("RestoreOptionPage renders with title and radio options", () => {
    const { container } = render(
      <TestShell>
        <RestoreOptionPage />
      </TestShell>
    );
    expectRendered(container);
    expect(screen.getByText(/choose restore option/i)).toBeTruthy();
    expect(screen.getByText(/restore from local openclaw instance/i)).toBeTruthy();
    expect(screen.getByText(/restore from backup file/i)).toBeTruthy();
  });

  it("RestoreOptionPage renders two radio inputs", () => {
    const { container } = render(
      <TestShell>
        <RestoreOptionPage />
      </TestShell>
    );
    const radios = container.querySelectorAll("input[type='radio']");
    expect(radios.length).toBe(2);
  });

  it("RestoreOptionPage has 'local' selected by default", () => {
    const { container } = render(
      <TestShell>
        <RestoreOptionPage />
      </TestShell>
    );
    const localRadio = container.querySelector(
      "input[type='radio'][value='local']"
    ) as HTMLInputElement;
    const fileRadio = container.querySelector(
      "input[type='radio'][value='file']"
    ) as HTMLInputElement;
    expect(localRadio?.checked).toBe(true);
    expect(fileRadio?.checked).toBe(false);
  });

  it("RestoreOptionPage allows switching to 'file' option", () => {
    const { container } = render(
      <TestShell>
        <RestoreOptionPage />
      </TestShell>
    );
    const fileRadio = container.querySelector(
      "input[type='radio'][value='file']"
    ) as HTMLInputElement;
    fireEvent.click(fileRadio);
    expect(fileRadio?.checked).toBe(true);
  });

  it("RestoreOptionPage renders Back and Continue buttons", () => {
    render(
      <TestShell>
        <RestoreOptionPage />
      </TestShell>
    );
    expect(screen.getByRole("button", { name: /back/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /continue/i })).toBeTruthy();
  });

  it("RestoreOptionPage renders onboarding progress dots", () => {
    const { container } = render(
      <TestShell>
        <RestoreOptionPage />
      </TestShell>
    );
    const dots = container.querySelectorAll("[class*='OnboardingDot']");
    expect(dots.length).toBeGreaterThanOrEqual(5);
  });

  it("RestoreOptionPage shows subtitle text", () => {
    render(
      <TestShell>
        <RestoreOptionPage />
      </TestShell>
    );
    expect(screen.getByText(/import an existing setup/i)).toBeTruthy();
  });

  // -- RestoreFilePage --

  it("RestoreFilePage renders with title and drop zone", () => {
    const { container } = render(
      <TestShell>
        <RestoreFilePage />
      </TestShell>
    );
    expectRendered(container);
    expect(screen.getByText(/restore from backup/i)).toBeTruthy();
    expect(screen.getByText(/drag backup archive here/i)).toBeTruthy();
  });

  it("RestoreFilePage renders 'choose a file' button", () => {
    render(
      <TestShell>
        <RestoreFilePage />
      </TestShell>
    );
    expect(screen.getByRole("button", { name: /choose a file/i })).toBeTruthy();
  });

  it("RestoreFilePage renders Back button", () => {
    render(
      <TestShell>
        <RestoreFilePage />
      </TestShell>
    );
    expect(screen.getByRole("button", { name: /back/i })).toBeTruthy();
  });

  it("RestoreFilePage renders warning block", () => {
    render(
      <TestShell>
        <RestoreFilePage />
      </TestShell>
    );
    expect(screen.getByText(/replace your current configuration/i)).toBeTruthy();
  });

  it("RestoreFilePage renders hidden file input", () => {
    const { container } = render(
      <TestShell>
        <RestoreFilePage />
      </TestShell>
    );
    const fileInput = container.querySelector("input[type='file']") as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe(".zip,.gz,.tgz");
  });

  it("RestoreFilePage renders onboarding progress dots", () => {
    const { container } = render(
      <TestShell>
        <RestoreFilePage />
      </TestShell>
    );
    const dots = container.querySelectorAll("[class*='OnboardingDot']");
    expect(dots.length).toBeGreaterThanOrEqual(5);
  });
});
