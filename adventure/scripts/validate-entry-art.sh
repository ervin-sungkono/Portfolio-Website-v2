#!/usr/bin/env bash
# Verify the optimized image preserves every source RGB pixel; FFmpeg is required.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
original='public/game/town-proof.png'
optimized='public/game/town-proof-lossless.webp'
dimensions() { ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$1"; }
pixels() { ffmpeg -v error -i "$1" -f rawvideo -pix_fmt rgb24 - | sha256sum | cut -d' ' -f1; }
[[ "$(dimensions "$original")" == "$(dimensions "$optimized")" ]] || { echo 'Entry artwork dimensions differ.' >&2; exit 1; }
[[ "$(pixels "$original")" == "$(pixels "$optimized")" ]] || { echo 'Entry artwork pixels differ.' >&2; exit 1; }
echo "Entry artwork pixels and dimensions match; PNG $(stat -c '%s' "$original") bytes, WebP $(stat -c '%s' "$optimized") bytes."
