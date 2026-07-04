#!/usr/bin/env bash
# Re-encode demo MP4s for faster web playback (requires ffmpeg).
# Run from repo root: bash scripts/optimize-videos.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/assets"

if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v node >/dev/null 2>&1; then
    FFMPEG="$(node -e "try { console.log(require('@ffmpeg-installer/ffmpeg').path); } catch (e) { process.exit(1); }" 2>/dev/null || true)"
    if [ -n "${FFMPEG:-}" ]; then
      export PATH="$(dirname "$FFMPEG"):$PATH"
    fi
  fi
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Install ffmpeg first: brew install ffmpeg"
  echo "Or: npm install --no-save @ffmpeg-installer/ffmpeg"
  exit 1
fi

encode() {
  local input="$1"
  local output="$2"
  local scale="$3"
  local crf="$4"
  echo "→ $output"
  ffmpeg -y -i "$input" \
    -an \
    -c:v libx264 \
    -profile:v main \
    -pix_fmt yuv420p \
    -vf "scale=${scale}:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" \
    -crf "$crf" \
    -preset slow \
    -movflags +faststart \
    "$output"
}

# Web (desktop) — ~960px wide, good quality
encode "$ASSETS/progressviewer-mockup.mp4" "$ASSETS/progressviewer-mockup-web.mp4" "960:-2" 28
encode "$ASSETS/jll-case-library.mp4" "$ASSETS/jll-case-library-web.mp4" "960:-2" 28

# Mobile — smaller files for phone (optional, wire via data-video-src-mobile)
encode "$ASSETS/progressviewer-mockup.mp4" "$ASSETS/progressviewer-mockup-mobile.mp4" "720:-2" 30
encode "$ASSETS/jll-case-library.mp4" "$ASSETS/jll-case-library-mobile.mp4" "720:-2" 30

echo "Done. Commit the new .mp4 files and push."
