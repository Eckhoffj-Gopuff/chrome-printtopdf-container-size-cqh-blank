#!/usr/bin/env bash
# Open an older (or newer) Chrome beside your normal one, to check the print dialog on that version.
#
# Usage:
#   tools/run-chrome.sh 127.0.6533.119          # a Chrome for Testing build (versions 113 and later)
#   tools/run-chrome.sh r1047731                # a Chromium snapshot by main-branch position (older builds)
#   tools/run-chrome.sh 128.0.6613.84 path/to/other.html   # open other files instead of the two repro files
#
# Your normal Chrome is not touched:
#   - the build is a separate app, downloaded into $CHROME_BUILDS_DIR (default ~/.cache/chrome-test-builds);
#   - it starts with a new, empty, throwaway profile (--user-data-dir), so it shares no settings, tabs, or extensions;
#   - nothing is installed into /Applications, and no default browser setting changes.
# Delete $CHROME_BUILDS_DIR to remove every downloaded build.
#
# macOS only (it uses `open -n`). On Linux, run the binary that `npx @puppeteer/browsers install` prints.
# Then: Ctrl/Cmd+P, destination "Save as PDF", and compare repro.html with repro-control.html. Write down the version
# from chrome://version. See COVERAGE.md ("Print from the Chrome UI").
set -euo pipefail

if [ $# -lt 1 ]; then
  sed -n '2,16p' "$0"
  exit 2
fi
spec="$1"; shift

repo="$(cd "$(dirname "$0")/.." && pwd)"
dir="${CHROME_BUILDS_DIR:-$HOME/.cache/chrome-test-builds}"
mkdir -p "$dir"

case "$spec" in
  r[0-9]*)
    # Snapshot builds exist only for some positions. Use the nearest one at or after the position you asked for.
    pos="${spec#r}"
    if [ "$(uname -m)" = "arm64" ]; then bucket="Mac_Arm"; else bucket="Mac"; fi
    prefix="$bucket/${pos:0:${#pos}-2}"       # the listing is by the position without its last two digits
    nearest="$(curl -s "https://storage.googleapis.com/storage/v1/b/chromium-browser-snapshots/o?prefix=$prefix&delimiter=/&maxResults=1000" \
      | grep -o "\"$bucket/[0-9]*/\"" | grep -o '[0-9]\{6,\}' | sort -n | awk -v p="$pos" '$1 >= p { print; exit }' || true)"
    if [ -z "$nearest" ]; then
      echo "No $bucket snapshot at or after position $pos in that block. Try a position a few hundred higher." >&2
      exit 1
    fi
    [ "$nearest" != "$pos" ] && echo "No snapshot at r$pos; using the nearest at or after it: r$nearest"
    target="chromium@$nearest"
    [ -n "${RESOLVE_ONLY:-}" ] && { echo "would install $target"; exit 0; }
    ;;
  *) target="chrome@$spec" ;;                 # Chrome for Testing version
esac

echo "Installing (or reusing) $target in $dir ..."
out="$(npx --yes @puppeteer/browsers install "$target" --path "$dir" | tail -n 1)"
bin="${out#* }"
if [ ! -x "$bin" ]; then
  echo "Could not find the browser binary. The installer printed: $out" >&2
  exit 1
fi
app="${bin%%/Contents/MacOS/*}"          # .../Google Chrome for Testing.app or .../Chromium.app
profile="$(mktemp -d "${TMPDIR:-/tmp}/chrome-profile.XXXXXX")"

if [ $# -gt 0 ]; then files=("$@"); else files=("$repo/repro.html" "$repo/repro-control.html"); fi
urls=()
for f in "${files[@]}"; do urls+=("file://$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"); done

echo "Opening: $app"
echo "Profile: $profile (throwaway)"
open -n "$app" --args --user-data-dir="$profile" --no-first-run --no-default-browser-check "${urls[@]}"

# `open` returns success even if the app crashes a moment later. Check that it is still running.
sleep 6
if ! pgrep -f -- "--user-data-dir=$profile" >/dev/null; then
  echo >&2
  echo "The browser exited right after it started, so there is no window to test." >&2
  echo "Older builds can crash or fail to draw on newer macOS. Example: a Chromium snapshot near 108 crashed on macOS 26.6.1" >&2
  echo "(signal 11 at startup). Try a neighbouring version, or use Docker, which does not depend on your macOS:" >&2
  echo "  tools/dialog-linux.sh <playwright-version> repro      # see COVERAGE.md" >&2
  exit 1
fi
echo "Now press Cmd+P in the new window. Check chrome://version for the exact version."
echo "If the window opens but stays blank, tell me the version and what you see; tools/dialog-linux.sh is a fallback."
