#!/usr/bin/env bash
set -euo pipefail
project="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$project/art/bird-animation"
editor="${LIBRESPRITE_APP:-/workspace/.tools/squashfs-root/AppRun}"
if [[ ! -x "$editor" ]]; then echo "LibreSprite not found at $editor" >&2; exit 1; fi
export XDG_CONFIG_HOME="$work/.config" XDG_CACHE_HOME="$work/.cache" XDG_RUNTIME_DIR="$work/.runtime"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR" "$work/working" "$work/outputs" "$work/sources/frames" "$project/public/game/arcade/bird-animation"
chmod 700 "$XDG_RUNTIME_DIR"
cp "$project/public/game/arcade/bird.png" "$work/outputs/up.png"
for pose in mid down; do
  if [[ "$pose" == mid ]]; then crop=774,103,600,488; else crop=1471,125,600,488; fi
  "$editor" -b "$work/sources/wing-study.png" --crop "$crop" --save-as "$work/working/$pose-crop.png" >/dev/null
  "$editor" -b "$work/working/$pose-crop.png" --shrink-to 64,52 --script "$project/scripts/clean-sprite-alpha.js" --save-as "$work/working/$pose-generated.png" >/dev/null
done
# Preserve the approved bird's head and body on the right; replace just the wing area.
ffmpeg -v error -y -i "$work/working/mid-generated.png" -i "$work/outputs/up.png" \
  -filter_complex '[0:v]format=rgba,crop=29:52:0:0[left];[1:v]format=rgba,crop=35:52:29:0[right];[left][right]hstack=inputs=2:shortest=1,format=rgba' \
  -frames:v 1 "$work/outputs/mid.png"
# Allow the lower wing to extend below the belly, underneath the stable body.
ffmpeg -v error -y -i "$work/working/down-generated.png" -i "$work/outputs/up.png" \
  -filter_complex 'color=c=black@0:s=64x52:r=1,format=rgba[base];[0:v]format=rgba,split=2[a][b];[a]crop=29:52:0:0[left];[b]crop=11:24:29:28[wing];[1:v]format=rgba,crop=35:52:29:0[body];[base][left]overlay=0:0:format=auto:shortest=1[c1];[c1][wing]overlay=29:28:format=auto:shortest=1[c2];[c2][body]overlay=29:0:format=auto:shortest=1,format=rgba' \
  -frames:v 1 "$work/outputs/down.png"
"$editor" -b "$work/outputs/down.png" --script "$work/close-eye.js" --save-as "$work/outputs/dazed.png" >/dev/null
for pose in up mid down dazed; do
  "$editor" -b "$work/outputs/$pose.png" --save-as "$work/sources/frames/$pose.aseprite" >/dev/null
  "$editor" -b "$work/sources/frames/$pose.aseprite" --save-as "$work/working/$pose-roundtrip.png" >/dev/null
  cp "$work/outputs/$pose.png" "$project/public/game/arcade/bird-animation/$pose.png"
done
echo 'Bird animation draft frames written.'
