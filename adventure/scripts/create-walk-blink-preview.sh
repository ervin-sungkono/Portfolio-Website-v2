#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
command -v ffmpeg >/dev/null || { echo 'FFmpeg is required for the review GIF.' >&2; exit 1; }

# This is a review study based on a generated four-column sheet, not a game atlas.
for frame_index in 0 1 2 3; do
  x_offset=$((frame_index * 543))
  bash "$root_dir/scripts/libresprite.sh" -b "$root_dir/art/proofs/walk-pose-study.png" \
    --crop "$x_offset,0,543,724" --save-as "$temp_dir/walk-$frame_index.png"
done
bash "$root_dir/scripts/libresprite.sh" -b "$root_dir/art/proofs/walk-blink-study.png" \
  --crop '543,0,543,724' --save-as "$temp_dir/blink-raw.png"

# Apply only the eyes/upper face from the blink study to the approved body pose.
ffmpeg -v error -y -i "$temp_dir/walk-1.png" -i "$temp_dir/blink-raw.png" \
  -filter_complex '[1:v]crop=200:100:165:195[eyes];[0:v][eyes]overlay=165:195:format=auto' \
  -frames:v 1 "$temp_dir/blink.png"

# Six walking loops at 6 fps; blink once for one frame rather than every step.
for ((i=0; i<24; i++)); do
  frame="$temp_dir/walk-$((i % 4)).png"
  if (( i == 17 )); then frame="$temp_dir/blink.png"; fi
  printf -v index '%02d' "$i"
  ln -s "$frame" "$temp_dir/sequence-$index.png"
done
ffmpeg -v error -y -framerate 6 -i "$temp_dir/sequence-%02d.png" \
  -f lavfi -i 'color=c=0xf5eddd:s=543x724:r=6' \
  -filter_complex '[1:v][0:v]overlay=shortest=1:format=auto,split[a][b];[a]palettegen[p];[b][p]paletteuse' \
  -loop 0 "$root_dir/art/proofs/walk-blink-preview.gif"
echo 'Blink preview created; regenerate its manifest hash if the output changes.'
