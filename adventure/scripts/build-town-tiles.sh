#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"
command -v ffmpeg >/dev/null || { echo 'FFmpeg is required to assemble the draft tileset.' >&2; exit 1; }
mkdir -p public/game/tiles
ffmpeg -v error -y -i art/tiles-work/outputs/grass-v3.png -i art/tiles-work/outputs/paving-v2.png \
  -filter_complex '[0:v][1:v]hstack=inputs=2' -frames:v 1 public/game/tiles/town-draft.png
echo 'Draft town tileset assembled.'
