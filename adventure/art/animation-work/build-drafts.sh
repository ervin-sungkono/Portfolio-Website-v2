#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$root_dir/art/animation-work"
destination="$root_dir/public/game/characters"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
mkdir -p "$destination"
for character in male female; do
  mkdir -p "$destination/$character"
  for direction in down left up right; do
    cp "$root_dir/art/drafts/turnarounds/$character-$direction.png" "$destination/$character/idle-$direction.png"
    # Input studies are not evenly registered. Offsets bring the head centroid
    # near the center of each canvas and preserve both feet inside the frame.
    case "$character-$direction" in
      male-down) offsets=(6 6 6 6) ;;
      male-left) offsets=(71 25 -17 -60) ;;
      male-up) offsets=(13 -1 -5 -13) ;;
      male-right) offsets=(42 -32 -58 -115) ;;
      female-down) offsets=(2 -42 -43 -42) ;;
      female-left) offsets=(48 20 -6 -12) ;;
      female-up) offsets=(11 11 11 11) ;;
      female-right) offsets=(15 -36 -62 -110) ;;
    esac
    for i in 0 1 2 3; do
      bash "$root_dir/scripts/libresprite.sh" -b "$work/studies/$character-$direction.png" \
        --crop "$((i * 543 + offsets[i])),0,543,724" --save-as "$temp_dir/crop.png" >/dev/null
      bash "$root_dir/scripts/libresprite.sh" -b "$temp_dir/crop.png" --shrink-to 96,128 \
        --script "$root_dir/scripts/clean-sprite-alpha.js" \
        --save-as "$destination/$character/walk-$direction-$i.png" >/dev/null
    done
  done
  # Use the blink study's second pose, registered as in walk-down-1. Overlay
  # only the face area so generated changes elsewhere cannot change the body.
  if [[ "$character" == male ]]; then blink_x=549; else blink_x=501; fi
  bash "$root_dir/scripts/libresprite.sh" -b "$work/studies/$character-blink.png" \
    --crop "$blink_x,0,543,724" --save-as "$temp_dir/blink.png" >/dev/null
  bash "$root_dir/scripts/libresprite.sh" -b "$temp_dir/blink.png" --shrink-to 96,128 \
    --script "$root_dir/scripts/clean-sprite-alpha.js" \
    --save-as "$temp_dir/blink-small.png" >/dev/null
  for base in walk-down-1 idle-down; do
    ffmpeg -v error -y -i "$destination/$character/$base.png" -i "$temp_dir/blink-small.png" \
      -filter_complex '[1:v]crop=50:22:25:32[face];[0:v][face]overlay=25:32:format=auto' \
      -frames:v 1 "$destination/$character/blink-$base.png"
  done
done
echo "Wrote provisional individual frames to $destination"
