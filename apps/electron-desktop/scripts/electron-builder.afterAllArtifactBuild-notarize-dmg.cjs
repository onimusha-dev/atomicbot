/* eslint-disable no-console */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: "utf-8", ...opts });
  if (res.status !== 0) {
    const stderr = String(res.stderr || "").trim();
    const stdout = String(res.stdout || "").trim();
    throw new Error(`${cmd} ${args.join(" ")} failed: ${stderr || stdout || `exit ${res.status}`}`);
  }
  return String(res.stdout || "");
}

function fileSizeBytes(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function listDirSafe(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

function findFirstAppBundle(dir) {
  for (const entry of listDirSafe(dir)) {
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      return path.join(dir, entry.name);
    }
  }
  return null;
}

function hasNotaryAuthEnv() {
  if (process.env.NOTARYTOOL_PROFILE && String(process.env.NOTARYTOOL_PROFILE).trim()) {
    return true;
  }
  const key = process.env.NOTARYTOOL_KEY && String(process.env.NOTARYTOOL_KEY).trim();
  const keyId = process.env.NOTARYTOOL_KEY_ID && String(process.env.NOTARYTOOL_KEY_ID).trim();
  const issuer = process.env.NOTARYTOOL_ISSUER && String(process.env.NOTARYTOOL_ISSUER).trim();
  return Boolean(key && keyId && issuer);
}

function repoRootFromHere() {
  // apps/electron-desktop/scripts -> repo root
  return path.resolve(__dirname, "..", "..", "..");
}

/**
 * electron-builder hook.
 *
 * Goal: notarize + staple the built DMG artifact (recommended for Gatekeeper).
 *
 * This runs only when NOTARIZE=1 is set (to avoid local builds accidentally hitting Apple).
 *
 * Docs:
 * - https://www.electron.build/configuration/configuration#afterallartifactbuild
 * - scripts/notarize-mac-artifact.sh (repo root)
 */
module.exports = async function afterAllArtifactBuild(context) {
  // `afterAllArtifactBuild` context does not consistently expose `electronPlatformName`
  // (unlike `afterSign`/`afterPack`). Gate on the current runtime + artifact extension.
  if (process.platform !== "darwin") {
    return;
  }

  const notarizeEnabled = String(process.env.NOTARIZE || "").trim() === "1";
  if (!notarizeEnabled) {
    console.log("[electron-desktop] afterAllArtifactBuild: NOTARIZE=1 not set (skipping DMG notarization)");
    return;
  }

  if (!hasNotaryAuthEnv()) {
    throw new Error(
      [
        "[electron-desktop] afterAllArtifactBuild: notary auth missing.",
        "Set NOTARYTOOL_PROFILE (keychain profile) OR NOTARYTOOL_KEY/NOTARYTOOL_KEY_ID/NOTARYTOOL_ISSUER (API key).",
      ].join("\n"),
    );
  }

  const artifacts = Array.isArray(context.artifactPaths) ? context.artifactPaths : [];
  const dmgs = artifacts.filter((p) => typeof p === "string" && p.endsWith(".dmg"));

  if (dmgs.length === 0) {
    console.log("[electron-desktop] afterAllArtifactBuild: no .dmg artifacts found (skipping)");
    return;
  }

  const repoRoot = repoRootFromHere();
  const notarizeScript = path.join(repoRoot, "scripts", "notarize-mac-artifact.sh");
  if (!fs.existsSync(notarizeScript)) {
    throw new Error(`[electron-desktop] afterAllArtifactBuild: notarize script not found: ${notarizeScript}`);
  }

  console.log(`[electron-desktop] afterAllArtifactBuild: notarizing ${dmgs.length} DMG artifact(s) …`);
  for (const dmgPath of dmgs) {
    const size = fileSizeBytes(dmgPath);
    // A DMG that contains the app bundle is typically hundreds of MB here. If it is tiny,
    // it likely ended up missing the .app (we've observed "background-only" DMGs).
    if (size > 0 && size < 50 * 1024 * 1024) {
      const outDir = context.outDir && typeof context.outDir === "string" ? context.outDir : path.dirname(dmgPath);
      const appOutDirGuess = path.join(outDir, `mac-${process.arch}`);
      const appOutDir =
        (context.appOutDir && typeof context.appOutDir === "string" ? context.appOutDir : null) || appOutDirGuess;
      const appBundle = findFirstAppBundle(appOutDir);
      if (appBundle) {
        const rebuildScript = path.resolve(__dirname, "build-dmg-from-app.sh");
        if (!fs.existsSync(rebuildScript)) {
          throw new Error(`[electron-desktop] afterAllArtifactBuild: rebuild script missing: ${rebuildScript}`);
        }
        console.log(
          `[electron-desktop] afterAllArtifactBuild: DMG looks too small (${size} bytes). Rebuilding from app: ${path.basename(
            appBundle,
          )}`,
        );
        run("bash", [rebuildScript, appBundle, dmgPath], { stdio: "inherit", env: process.env });
        // electron-builder generates a .blockmap for the original DMG. Since we rebuilt the DMG,
        // the blockmap is no longer valid (and we're not using electron-updater yet).
        const blockmapPath = `${dmgPath}.blockmap`;
        try {
          fs.rmSync(blockmapPath, { force: true });
        } catch {
          // ignore
        }
      } else {
        console.log(
          `[electron-desktop] afterAllArtifactBuild: DMG looks too small (${size} bytes) but app bundle not found in: ${appOutDir}`,
        );
      }
    }

    console.log(`[electron-desktop] afterAllArtifactBuild: notarizing DMG: ${dmgPath}`);
    run("bash", [notarizeScript, dmgPath], { stdio: "inherit", env: process.env });
  }
};

