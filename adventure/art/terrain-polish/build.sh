#!/usr/bin/env bash
set -euo pipefail
project="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$project/art/terrain-polish"
editor="${LIBRESPRITE_APP:-/workspace/.tools/squashfs-root/AppRun}"
if [[ ! -x "$editor" ]]; then echo "LibreSprite not found at $editor" >&2; exit 1; fi
export XDG_CONFIG_HOME="$work/.config" XDG_CACHE_HOME="$work/.cache" XDG_RUNTIME_DIR="$work/.runtime"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR" "$work/.temp" "$project/public/game/tiles"
chmod 700 "$XDG_RUNTIME_DIR"
ffmpeg -loglevel error -y -f lavfi -i 'color=c=black@0.0:s=128x128,format=rgba' -frames:v 1 "$work/.temp/canvas.png"
"$editor" -b "$work/.temp/canvas.png" --script "$work/draw-edge-atlas.js" --save-as "$work/ground-edges.aseprite" >/dev/null
"$editor" -b "$work/ground-edges.aseprite" --save-as "$project/public/game/tiles/town-edges.png" >/dev/null
printf '%s\n' 'Wrote the editable edge atlas and transparent PNG.'
