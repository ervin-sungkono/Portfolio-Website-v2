#!/usr/bin/env bash
set -euo pipefail
project="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$project/art/npc-polish"
editor="${LIBRESPRITE_APP:-/workspace/.tools/squashfs-root/AppRun}"
if [[ ! -x "$editor" ]]; then echo "LibreSprite not found at $editor" >&2; exit 1; fi
export XDG_CONFIG_HOME="$work/.config" XDG_CACHE_HOME="$work/.cache" XDG_RUNTIME_DIR="$work/.runtime"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR" "$work/.temp"
chmod 700 "$XDG_RUNTIME_DIR"
for npc in guide workshop; do
  mkdir -p "$work/frames/$npc" "$work/raw-frames/$npc" "$work/sources/$npc"
  if [[ "$npc" == guide ]]; then offsets=(45 0 -45 -89); else offsets=(16 16 16 16); fi
  for i in 0 1 2 3; do
    "$editor" -b "$work/studies/$npc-idle.png" --crop "$((543 * i + offsets[i])),0,543,724" \
      --save-as "$work/.temp/$npc-crop-$i.png" >/dev/null
    "$editor" -b "$work/.temp/$npc-crop-$i.png" --shrink-to 96,128 \
      --script "$project/scripts/clean-sprite-alpha.js" --save-as "$work/raw-frames/$npc/idle-$i.png" >/dev/null
  done
  cp "$work/raw-frames/$npc/idle-0.png" "$work/frames/$npc/idle-0.png"
  for i in 1 2 3; do
    # Retain the same head, body, and feet to avoid generative frame flicker.
    # Use the generated torso variations for a gentle breath and only the
    # small face area for the closed-eye frame.
    if (( i == 2 )); then x=27; y=29; w=44; h=22; else x=25; y=56; w=50; h=38; fi
    ffmpeg -v error -y -i "$work/raw-frames/$npc/idle-0.png" -i "$work/raw-frames/$npc/idle-$i.png" \
      -filter_complex "[1:v]crop=$w:$h:$x:$y[patch];[0:v][patch]overlay=$x:$y:format=auto" \
      -frames:v 1 "$work/frames/$npc/idle-$i.png"
  done
  for i in 0 1 2 3; do
    "$editor" -b "$work/frames/$npc/idle-$i.png" \
      --save-as "$work/sources/$npc/idle-$i.aseprite" >/dev/null
  done
done
echo 'NPC draft frames written.'
