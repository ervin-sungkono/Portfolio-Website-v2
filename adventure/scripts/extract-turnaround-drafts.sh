#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
input="$root_dir/art/proofs/explorers-four-directions.png"
output="$root_dir/art/drafts/turnarounds"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
mkdir -p "$output"

# Crop rectangles are specific to the reviewed generated proof. The female
# side-view columns are reversed in that proof; map names to actual facing.
make_draft() {
  local gender="$1" direction="$2" x="$3" y="$4" height="$5" padding="$6"
  local name="${gender}-${direction}"
  bash "$root_dir/scripts/libresprite.sh" -b "$input" --crop "$x,$y,320,$height" \
    --save-as "$temp_dir/$name-cell.png" >/dev/null
  bash "$root_dir/scripts/libresprite.sh" -b "$temp_dir/$name-cell.png" --shrink-to 96,128 \
    --script "$root_dir/scripts/clean-sprite-alpha.js" --save-as "$temp_dir/$name-clean.png" >/dev/null
  bash "$root_dir/scripts/libresprite.sh" -b "$temp_dir/$name-clean.png" --crop "-$padding,0,96,128" \
    --save-as "$output/$name.png" >/dev/null
  bash "$root_dir/scripts/libresprite.sh" -b "$output/$name.png" \
    --save-as "$output/$name.aseprite" >/dev/null
}

make_draft male down 130 0 480 5
make_draft male left 450 0 480 5
make_draft male up 770 0 480 5
make_draft male right 1090 0 480 5
make_draft female down 115 490 490 6
make_draft female left 1075 490 490 6
make_draft female up 755 490 490 6
make_draft female right 435 490 490 6

echo "Wrote eight draft PNGs and editable single-frame files to $output."
