/**
 * Tests for path resolution functions in paths.ts.
 * Validates that each resolve* function constructs correct paths
 * for the current platform/arch combination.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  resolveRepoRoot,
  resolveBundledOpenClawDir,
  resolveBundledNodeBin,
  bundledBin,
  downloadedBin,
  resolveBin,
  resolveBundledGogCredentialsPath,
  resolveDownloadedGogCredentialsPath,
  resolveGogCredentialsPaths,
  resolveRendererIndex,
  resolvePreloadPath,
} from "./paths";

// process.resourcesPath is only available in packaged Electron.
// We mock it for testing.
const MOCK_RESOURCES = "/mock/resources";
Object.defineProperty(process, "resourcesPath", {
  value: MOCK_RESOURCES,
  writable: true,
  configurable: true,
});

const platform = process.platform;
const arch = process.arch;
const platArch = `${platform}-${arch}`;

describe("resolveRepoRoot", () => {
  it("returns three directories up from mainDir", () => {
    const result = resolveRepoRoot("/app/electron-desktop/dist");
    // dist -> electron-desktop -> app -> (root)
    expect(result).toBe(path.resolve("/app/electron-desktop/dist", "..", "..", ".."));
  });
});

describe("resolveBundled* functions", () => {
  it("resolveBundledOpenClawDir returns resourcesPath/openclaw", () => {
    expect(resolveBundledOpenClawDir()).toBe(path.join(MOCK_RESOURCES, "openclaw"));
  });

  it("resolveBundledNodeBin returns correct platform-specific path", () => {
    const result = resolveBundledNodeBin();
    if (platform === "win32") {
      expect(result).toBe(path.join(MOCK_RESOURCES, "node", platArch, "node.exe"));
    } else {
      expect(result).toBe(path.join(MOCK_RESOURCES, "node", platArch, "bin", "node"));
    }
  });

  it("resolveBundledGogCredentialsPath returns correct path", () => {
    expect(resolveBundledGogCredentialsPath()).toBe(
      path.join(MOCK_RESOURCES, "gog-credentials", "gog-client-secret.json"),
    );
  });
});

describe("bundledBin", () => {
  it("returns resourcesPath/<tool>/<platArch>/<tool> for each tool", () => {
    const tools = ["gog", "jq", "memo", "remindctl", "obsidian-cli", "gh"];
    for (const tool of tools) {
      expect(bundledBin(tool)).toBe(path.join(MOCK_RESOURCES, tool, platArch, tool));
    }
  });
});

describe("downloadedBin", () => {
  const mainDir = "/app/electron-desktop/dist";
  const appDir = path.resolve(mainDir, "..");

  it("returns appDir/.<tool>-runtime/<platArch>/<tool> for each tool", () => {
    const tools = ["gog", "jq", "memo", "remindctl", "obsidian-cli", "gh"];
    for (const tool of tools) {
      expect(downloadedBin(mainDir, tool)).toBe(
        path.join(appDir, `.${tool}-runtime`, platArch, tool),
      );
    }
  });
});

describe("resolveBin", () => {
  const mainDir = "/app/electron-desktop/dist";
  const appDir = path.resolve(mainDir, "..");

  it("returns bundled path when isPackaged is true", () => {
    expect(resolveBin("gog", { isPackaged: true, mainDir })).toBe(
      path.join(MOCK_RESOURCES, "gog", platArch, "gog"),
    );
  });

  it("returns downloaded path when isPackaged is false", () => {
    expect(resolveBin("gog", { isPackaged: false, mainDir })).toBe(
      path.join(appDir, ".gog-runtime", platArch, "gog"),
    );
  });

  it("works for all known tools", () => {
    const tools = ["gog", "jq", "memo", "remindctl", "obsidian-cli", "gh"];
    for (const tool of tools) {
      // Bundled
      expect(resolveBin(tool, { isPackaged: true, mainDir })).toBe(
        path.join(MOCK_RESOURCES, tool, platArch, tool),
      );
      // Downloaded
      expect(resolveBin(tool, { isPackaged: false, mainDir })).toBe(
        path.join(appDir, `.${tool}-runtime`, platArch, tool),
      );
    }
  });
});

describe("resolveDownloadedGogCredentialsPath", () => {
  const mainDir = "/app/electron-desktop/dist";
  const appDir = path.resolve(mainDir, "..");

  it("returns correct path", () => {
    expect(resolveDownloadedGogCredentialsPath(mainDir)).toBe(
      path.join(appDir, ".gog-runtime", "credentials", "gog-client-secret.json"),
    );
  });
});

describe("resolveGogCredentialsPaths", () => {
  it("returns an array of paths", () => {
    const paths = resolveGogCredentialsPaths();
    expect(Array.isArray(paths)).toBe(true);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    for (const p of paths) {
      expect(p).toContain("credentials.json");
    }
  });
});

describe("resolveRendererIndex", () => {
  it("returns packaged path when isPackaged is true", () => {
    const result = resolveRendererIndex({
      isPackaged: true,
      appPath: "/app",
      mainDir: "/app/dist",
    });
    expect(result).toBe(path.join("/app", "renderer", "dist", "index.html"));
  });

  it("returns dev path when isPackaged is false", () => {
    const result = resolveRendererIndex({
      isPackaged: false,
      appPath: "/app",
      mainDir: "/app/electron-desktop/dist",
    });
    const expected = path.join(
      path.resolve("/app/electron-desktop/dist", ".."),
      "renderer",
      "dist",
      "index.html",
    );
    expect(result).toBe(expected);
  });
});

describe("resolvePreloadPath", () => {
  it("returns mainDir/preload.js", () => {
    expect(resolvePreloadPath("/app/dist")).toBe(path.join("/app/dist", "preload.js"));
  });
});
