#!/usr/bin/env bash
set -euo pipefail

# Rebuild a DMG from a given .app bundle.
#
# This script is used by electron-builder's afterAllArtifactBuild hook as a recovery
# path when the generated DMG is unexpectedly small (typically missing the .app).
#
# Usage:
#   ./build-dmg-from-app.sh "/path/to/My App.app" "/path/to/out.dmg"
#
# Notes:
# - Uses only macOS built-ins (hdiutil, ditto).
# - Produces a compressed UDZO DMG with a volume name derived from the app bundle.

APP_BUNDLE="${1:-}"
DMG_OUT="${2:-}"

if [[ -z "$APP_BUNDLE" || -z "$DMG_OUT" ]]; then
  echo "Usage: $0 <app-bundle-path> <dmg-output-path>" >&2
  exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: this script is intended to run on macOS (Darwin)." >&2
  exit 1
fi

if [[ ! -d "$APP_BUNDLE" || "$APP_BUNDLE" != *.app ]]; then
  echo "Error: app bundle not found (or not a .app dir): $APP_BUNDLE" >&2
  exit 1
fi

OUT_DIR="$(dirname "$DMG_OUT")"
mkdir -p "$OUT_DIR"

APP_NAME="$(basename "$APP_BUNDLE")"
VOL_NAME="${APP_NAME%.app}"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

STAGING_DIR="$TMP_DIR/staging"
mkdir -p "$STAGING_DIR"

# Copy the .app into a staging folder so the DMG has exactly one top-level app.
ditto "$APP_BUNDLE" "$STAGING_DIR/$APP_NAME"

TMP_DMG="$TMP_DIR/out.dmg"

# Overwrite any existing output (electron-builder will already have created one).
rm -f "$DMG_OUT"

echo "[electron-desktop] build-dmg-from-app: creating DMG for: $APP_NAME"
echo "[electron-desktop] build-dmg-from-app: output: $DMG_OUT"

hdiutil create \
  -volname "$VOL_NAME" \
  -srcfolder "$STAGING_DIR" \
  -format UDZO \
  -imagekey zlib-level=9 \
  "$TMP_DMG" >/dev/null

mv -f "$TMP_DMG" "$DMG_OUT"

echo "[electron-desktop] build-dmg-from-app: done"
#!/usr/bin/env bash
set -euo pipefail

# Build a simple DMG that contains:
# - <App>.app
# - /Applications symlink
#
# This is a fallback for cases where electron-builder produced a DMG missing the app bundle.
#
# Usage:
#   scripts/build-dmg-from-app.sh <app_path> <output_dmg>
#
# Env:
#   DMG_VOLUME_NAME   override volume name (defaults to CFBundleName)
#   DMG_MARGIN_MB     extra space added to image size (default: 80)

APP_PATH="${1:-}"
OUT_DMG="${2:-}"

if [[ -z "$APP_PATH" || -z "$OUT_DMG" ]]; then
  echo "Usage: $0 <app_path> <output_dmg>" >&2
  exit 1
fi
if [[ ! -d "$APP_PATH" ]]; then
  echo "Error: app bundle not found: $APP_PATH" >&2
  exit 1
fi

APP_NAME=$(/usr/libexec/PlistBuddy -c "Print CFBundleName" "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo "Atomic Bot")
DMG_VOLUME_NAME="${DMG_VOLUME_NAME:-$APP_NAME}"
DMG_MARGIN_MB="${DMG_MARGIN_MB:-80}"

TMP_DIR="$(mktemp -d /tmp/atomicbot-dmg.XXXXXX)"
trap 'rm -rf "$TMP_DIR" 2>/dev/null || true' EXIT

cp -R "$APP_PATH" "$TMP_DIR/"
ln -s /Applications "$TMP_DIR/Applications"

APP_SIZE_MB="$(du -sm "$APP_PATH" | awk '{print $1}')"
DMG_SIZE_MB=$((APP_SIZE_MB + DMG_MARGIN_MB))

RW_DMG="${OUT_DMG%.dmg}-rw.dmg"
rm -f "$RW_DMG" "$OUT_DMG"

echo "[atomicbot] build-dmg-from-app: creating RW image (${DMG_SIZE_MB}m)"
hdiutil create \
  -volname "$DMG_VOLUME_NAME" \
  -srcfolder "$TMP_DIR" \
  -ov \
  -format UDRW \
  -size "${DMG_SIZE_MB}m" \
  "$RW_DMG" >/dev/null

echo "[atomicbot] build-dmg-from-app: converting to compressed DMG"
hdiutil convert "$RW_DMG" -format ULMO -o "$OUT_DMG" -ov >/dev/null
rm -f "$RW_DMG"

hdiutil verify "$OUT_DMG" >/dev/null
echo "[atomicbot] build-dmg-from-app: ready: $OUT_DMG"

