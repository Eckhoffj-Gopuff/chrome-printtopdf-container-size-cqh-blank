#!/bin/bash
# Runs INSIDE the container built from tools/Dockerfile.dialog. Do not run it on the host: use tools/dialog-linux.sh.
# Opens a headed Chromium on a virtual display, presses Ctrl+P, and screenshots the print dialog.
#
# Usage: dialog-in-container.sh <playwright-version> <repro|repro-control> [chrome args...]
# Environment: LABEL (optional) is added to the file name, for example to mark a run that used a flag.
# Output: /out/chromium-<chromium version>-<file>[-<label>].png
set -u
v=$1; f=$2; shift 2
d=/w/pw-$v; mkdir -p "$d" && cd "$d" || exit 1
[ -d node_modules ] || { npm init -y >/dev/null 2>&1; npm i --silent "playwright@$v" >/dev/null 2>&1; }
export PLAYWRIGHT_BROWSERS_PATH=/w/browsers-$v
npx playwright install chromium >/dev/null 2>&1
CHROME=$(node -e "console.log(require('playwright').chromium.executablePath())")
VERSION=$("$CHROME" --version 2>/dev/null | grep -o '[0-9][0-9.]*' | head -1)
pkill Xvfb 2>/dev/null; Xvfb :99 -screen 0 1280x900x24 >/dev/null 2>&1 & sleep 2
export DISPLAY=:99
P=$(mktemp -d)
"$CHROME" --no-sandbox --user-data-dir="$P" --no-first-run --no-default-browser-check \
  --window-size=1260,880 --window-position=0,0 "$@" "file:///repro/$f.html" >/dev/null 2>&1 &
sleep 7
xdotool key ctrl+p
sleep 7
out="/out/chromium-${VERSION}-${f}${LABEL:+-$LABEL}.png"
import -window root "$out"
echo "Chromium $VERSION, $f${LABEL:+, $LABEL}: $(basename "$out")"
pkill -f "$CHROME" 2>/dev/null; pkill Xvfb 2>/dev/null
