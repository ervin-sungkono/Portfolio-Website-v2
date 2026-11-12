#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
mkdir -p public/game/residents
work="$(mktemp -d "${TMPDIR:-/tmp}/town-residents.XXXXXXXX")"
trap 'rm -rf "$work"' EXIT

# Trim alpha specks, preserve the pixel-art shading, and align each figure to one baseline.
make_sprite() {
  local source="$1" region="$2" output="$3"
  magick "$source" -crop "$region" +repage -channel A -threshold 10% +channel -trim +repage \
    -filter box -resize 52x82 -background none -gravity south -extent 67x90 "$output"
}
make_sprite art/residents/sources/gardener-baker-generated.png '887x887+0+0' public/game/residents/gardener.png
make_sprite art/residents/sources/gardener-baker-generated.png '887x887+887+0' public/game/residents/baker.png
make_walk_sheet() {
  local person="$1" cell_width="$2" cell_height="$3"
  local source="art/residents/sources/$person-four-step-generated.png"
  # Crop fixed source cells, align the heads, and seat the feet on the baseline.
  for frame in 0 1 2 3; do
    local horizontal_shift=0 vertical_shift=8 offset
    if [[ "$person" == artist ]]; then
      local -a artist_shifts=(-4 -1 1 4)
      horizontal_shift="${artist_shifts[$frame]}"
      vertical_shift=11
    fi
    printf -v offset '%+d%+d' "$horizontal_shift" "$vertical_shift"
    magick "$source" -crop "${cell_width}x${cell_height}+$((frame * cell_width))+0" +repage \
      -channel A -threshold 10% +channel -filter box -resize '67x90!' -roll "$offset" \
      "PNG32:$work/$person-$frame.png"
  done
  magick "$work/$person-0.png" "$work/$person-1.png" "$work/$person-2.png" "$work/$person-3.png" \
    +append +repage -depth 8 "PNG32:public/game/residents/$person-walk-v2.png"
}
make_walk_sheet artist 543 724
make_walk_sheet traveler 541 726
echo 'Built two idle sprites and two 4-frame walking sheets.'
