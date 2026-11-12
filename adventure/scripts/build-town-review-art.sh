#!/usr/bin/env bash
set -euo pipefail
review_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$review_root"
source_dir=art/town-redesign/sources
output_dir=public/art-review/assets
mkdir -p "$output_dir"
work="$(mktemp -d "${TMPDIR:-/tmp}/town-art-review.XXXXXXXX")"
trap 'rm -rf "$work"' EXIT

# Review exports only. The gameplay atlas and map deliberately stay untouched.
sprite() {
  local source="$1" region="$2" size="$3" destination="$4"
  magick "$source_dir/$source.png" -crop "$region" +repage \
    -channel A -threshold 60% +channel -trim +repage -filter box -resize "$size" \
    -background none -gravity center -extent "$size" -strip "PNG32:$output_dir/$destination.png"
}
for index in 0 1 2 3; do
  terrain_names=(grass plaza garden-path promenade)
  magick "$source_dir/terrain.png" -crop "627x627+$((index % 2 * 627))+$((index / 2 * 627))" \
    +repage -filter box -resize '128x128!' -strip "PNG32:$output_dir/${terrain_names[$index]}.png"
done
# Match the paving phases at repeat boundaries instead of cutting arbitrary swatches.
magick "$source_dir/terrain.png" -crop '418x418+644+70' +repage -filter box -resize '128x128!' -strip "PNG32:$output_dir/plaza.png"
magick "$source_dir/terrain.png" -crop '420x420+650+641' +repage -filter box -resize '128x128!' -strip "PNG32:$output_dir/promenade.png"
sprite depth-kit '850x450+60+160' '256x128' raised-wall
sprite depth-kit '540x540+940+100' '128x144' stairs
sprite depth-kit '650x550+1510+95' '176x144' garden-corner
sprite photo-garden '1448x1086+0+0' '768x576' photo-garden
sprite street-groups '768x720+0+140' '448x416' cafe-patio
sprite street-groups '768x720+768+140' '448x416' arcade-nook
sprite botanical '724x724+0+0' '160x192' willow
sprite botanical '724x724+724+0' '176x176' blossom-tree
sprite botanical '724x724+1448+0' '192x144' waterside-planting

atlas() {
  local name="$1" crop_width="$2" crop_height="$3" inset_x="$4" inset_y="$5" size="$6"
  for frame in 0 1 2 3; do
    magick "$source_dir/$name.png" -crop "${crop_width}x${crop_height}+$((frame * 543 + inset_x))+$inset_y" +repage \
      -channel A -threshold 60% +channel -filter box -resize "$size!" -strip "PNG32:$work/$name-$frame.png"
  done
  magick "$work/$name-0.png" "$work/$name-1.png" "$work/$name-2.png" "$work/$name-3.png" \
    +append -strip "PNG32:$output_dir/$name.png"
}
atlas fountain 500 544 20 80 160x176
atlas waterfall 543 360 0 180 192x128
atlas tree 495 520 25 80 160x176
atlas river-water 543 543 0 90 96x96

# Reuse one static cel. Generated redraws are confined to water or the canopy.
mask_dir=art/town-redesign/masks
mkdir -p "$mask_dir"
magick -size 160x176 xc:black -fill white -draw 'ellipse 80,108 54,20 0,360' \
  -fill black -draw 'ellipse 80,96 36,19 0,360' \
  -fill white -draw 'ellipse 80,72 26,11 0,360' \
  -fill black -draw 'ellipse 80,63 10,13 0,360' \
  -fill white -draw 'rectangle 44,0 116,53' -alpha copy -strip "$mask_dir/fountain.png"
magick -size 192x128 xc:black -fill white -draw 'rectangle 80,44 114,104' \
  -draw 'polygon 79,97 113,97 123,104 138,108 140,117 125,125 67,125 52,117 54,108 68,104' \
  -alpha copy -strip "$mask_dir/waterfall.png"
magick -size 160x176 xc:black -fill white -draw 'rectangle 0,0 159,117' \
  -alpha copy -strip "$mask_dir/tree.png"
lock_static() {
  local name="$1" width="$2" height="$3"
  local mask="$mask_dir/$name.png"
  magick "$output_dir/$name.png" -crop "${width}x${height}+0+0" +repage "$work/$name-base.png"
  magick "$work/$name-base.png" "$mask" -compose DstOut -composite "$work/$name-static.png"
  for frame in 0 1 2 3; do
    magick "$output_dir/$name.png" -crop "${width}x${height}+$((frame * width))+0" +repage \
      "$mask" -compose DstIn -composite "$work/$name-moving.png"
    magick "$work/$name-static.png" "$work/$name-moving.png" -compose Over -composite \
      -strip "PNG32:$work/$name-locked-$frame.png"
  done
  magick "$work/$name-locked-0.png" "$work/$name-locked-1.png" "$work/$name-locked-2.png" "$work/$name-locked-3.png" \
    +append -strip "PNG32:$output_dir/$name.png"
}
lock_static fountain 160 176
lock_static waterfall 192 128
lock_static tree 160 176
magick art/town-redesign/approved-reference.png -resize '1200x1200>' -quality 92 -strip "$output_dir/reference.webp"
printf 'Exported isolated review assets; no gameplay art or map files changed.\n'
