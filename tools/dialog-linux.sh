#!/usr/bin/env bash
# Screenshot Chromium's print dialog for repro.html or repro-control.html, on Linux, in Docker.
# It needs no Chrome on your machine and works on any host OS that runs Docker, including macOS 26, where old
# Chrome builds crash or fail to render. Playwright's Chromium builds map to versions like this:
#   1.27.1 -> Chromium 107   1.28.1 -> 108   1.45.2 -> 127   1.64.1 -> 156 (any Playwright version works)
#
# Usage:
#   tools/dialog-linux.sh <playwright-version> <repro|repro-control> [label] [chrome args...]
#   tools/dialog-linux.sh 1.28.1 repro                                         # Chromium 108: blank preview
#   tools/dialog-linux.sh 1.28.1 repro LayoutNGPrinting-disabled --disable-features=LayoutNGPrinting   # 108: prints
#
# Output: results/linux-dialog/chromium-<version>-<file>[-<label>].png. Look at the preview pane: blank except for the
# date, title, and URL that Chrome adds, or the text 10.3.0 and the two UNRELATED lines.
set -euo pipefail
if [ $# -lt 2 ]; then awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print } /^set /{ exit }' "$0"; exit 2; fi
v="$1"; f="$2"; shift 2
label=""
if [ $# -gt 0 ] && [[ "$1" != --* ]]; then label="$1"; shift; fi

repo="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$repo/results/linux-dialog"
image="repro-dialog:playwright-1.45.2"
if ! docker image inspect "$image" >/dev/null 2>&1; then
  echo "Building the image once (Playwright plus a virtual display) ..."
  docker build -q -t "$image" -f "$repo/tools/Dockerfile.dialog" "$repo/tools" >/dev/null
fi

docker run --rm \
  -v "$repo":/repro:ro \
  -v "$repo/tools/dialog-in-container.sh":/w/dialog.sh:ro \
  -v "$repo/results/linux-dialog":/out \
  -e LABEL="$label" -w /w "$image" \
  bash /w/dialog.sh "$v" "$f" "$@"
