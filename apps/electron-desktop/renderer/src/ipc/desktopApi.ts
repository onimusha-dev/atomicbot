/**
 * Typed wrapper around `window.openclawDesktop` — the Electron preload
 * IPC bridge exposed via `contextBridge.exposeInMainWorld`.
 *
 * All renderer code should import from this module instead of accessing
 * `window.openclawDesktop` directly.  This centralises the availability
 * check, improves testability, and gives a single place to evolve the
 * API surface.
 */

/** The full desktop IPC API shape (mirrors env.d.ts declaration). */
export type DesktopApi = NonNullable<Window["openclawDesktop"]>;

/**
 * Returns the desktop IPC API.
 * Throws if running outside Electron (e.g. in a browser or test
 * environment without mocks).
 */
export function getDesktopApi(): DesktopApi {
  const api = window.openclawDesktop;
  if (!api) {
    throw new Error("Desktop API not available — not running inside Electron");
  }
  return api;
}

/**
 * Returns the desktop IPC API, or `null` when unavailable.
 * Use for optional interactions that should silently no-op in
 * non-Electron contexts.
 */
export function getDesktopApiOrNull(): DesktopApi | null {
  return window.openclawDesktop ?? null;
}

/**
 * Whether the desktop API is currently available.
 */
export function isDesktopApiAvailable(): boolean {
  return window.openclawDesktop != null;
}
