#!/usr/bin/env bash
set -euo pipefail
project="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$project/art/arcade-assets"
editor="${LIBRESPRITE_APP:-/workspace/.tools/squashfs-root/AppRun}"
if [[ ! -x "$editor" ]]; then echo "LibreSprite not found at $editor" >&2; exit 1; fi
export XDG_CONFIG_HOME="$work/.config" XDG_CACHE_HOME="$work/.cache" XDG_RUNTIME_DIR="$work/.runtime"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR" "$work/working" "$work/outputs" "$project/public/game/decor" "$project/public/game/arcade"
chmod 700 "$XDG_RUNTIME_DIR"
for asset in arcade bird; do
  if [[ "$asset" == arcade ]]; then crop=120,40,830,1320; size=96,128; runtime="$project/public/game/decor/arcade.png"; else crop=390,210,750,620; size=64,64; runtime="$project/public/game/arcade/bird.png"; fi
  "$editor" -b "$work/sources/$asset-generated.png" --crop "$crop" --save-as "$work/working/$asset-crop.png" >/dev/null
  "$editor" -b "$work/working/$asset-crop.png" --shrink-to "$size" --script "$project/scripts/clean-sprite-alpha.js" --save-as "$work/outputs/$asset.png" >/dev/null
  "$editor" -b "$work/outputs/$asset.png" --save-as "$work/sources/$asset.aseprite" >/dev/null
  "$editor" -b "$work/sources/$asset.aseprite" --save-as "$work/working/$asset-roundtrip.png" >/dev/null
  cp "$work/outputs/$asset.png" "$runtime"
done
echo 'Arcade draft assets written.'
