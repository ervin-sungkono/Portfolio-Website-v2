#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
command -v ffmpeg >/dev/null || { echo 'FFmpeg is required for the review GIF.' >&2; exit 1; }
for frame_index in 0 1 2 3; do
  x_offset=$((frame_index * 543))
  bash "$root_dir/scripts/libresprite.sh" -b "$root_dir/art/proofs/walk-pose-study.png" \
    --crop "$x_offset,0,543,724" --save-as "$temp_dir/frame-$frame_index.png"
done
ffmpeg -v error -y -framerate 6 -i "$temp_dir/frame-%d.png" \
  -f lavfi -i 'color=c=0xf5eddd:s=543x724:r=6' \
  -filter_complex '[1:v][0:v]overlay=shortest=1:format=auto,split[a][b];[a]palettegen[p];[b][p]paletteuse' \
  -loop 0 "$root_dir/art/proofs/walk-preview.gif"
echo 'Review preview created; regenerate its manifest hash if the output changes.'
