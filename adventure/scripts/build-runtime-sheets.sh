#!/usr/bin/env bash
# Pack existing RGBA frames losslessly. FFmpeg and Node.js are required.
# --check validates existing sheets without changing them.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
if (( $# > 1 )) || { (( $# == 1 )) && [[ "$1" != '--check' ]]; }; then
  echo 'Usage: bash scripts/build-runtime-sheets.sh [--check]' >&2; exit 2
fi
check_only="${1:-}"
task_tmp="$(mktemp -d "${TMPDIR:-/tmp}/adventure-sheets.XXXXXXXX")"
trap 'rm -rf "$task_tmp"' EXIT
mkdir -p public/game/sheets

build_sheet() {
  local name="$1" columns="$2" rows="$3"; shift 3
  local work="$task_tmp/$name" path index=0 source_bytes=0 width height candidate
  local -a paths=("$@")
  mkdir -p "$work"
  printf '%s\0' "${paths[@]}" > "$work/manifest"
  for path in "${paths[@]}"; do
    ffmpeg -v error -i "$path" -frames:v 1 -f rawvideo -pix_fmt rgba -y "$work/$index.raw"
    index=$((index + 1))
  done
  node - "$work" "$columns" "$rows" <<'NODE'
const fs = require('node:fs');
const [work, colArg, rowArg] = process.argv.slice(2);
const columns = Number(colArg), rows = Number(rowArg), frameWidth = 96, frameHeight = 128, channels = 4;
const width = columns * frameWidth, height = rows * frameHeight;
const paths = fs.readFileSync(`${work}/manifest`, 'utf8').split('\0').filter(Boolean);
if (paths.length > columns * rows) throw new Error('Too many animation frames for sheet');
const sheet = Buffer.alloc(width * height * channels); // Blank cells are fully transparent.
let sourceBytes = 0;
for (const [index, path] of paths.entries()) {
  const png = fs.readFileSync(path);
  sourceBytes += png.length;
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== frameWidth || png.readUInt32BE(20) !== frameHeight) throw new Error(`Expected a 96x128 PNG: ${path}`);
  const frame = fs.readFileSync(`${work}/${index}.raw`);
  if (frame.length !== frameWidth * frameHeight * channels) throw new Error(`Unexpected pixel count: ${path}`);
  const col = index % columns, row = Math.floor(index / columns);
  for (let y = 0; y < frameHeight; y++) {
    const from = y * frameWidth * channels;
    const to = ((row * frameHeight + y) * width + col * frameWidth) * channels;
    frame.copy(sheet, to, from, from + frameWidth * channels);
  }
}
fs.writeFileSync(`${work}/packed.raw`, sheet);
fs.writeFileSync(`${work}/source-bytes`, String(sourceBytes));
NODE
  width=$((columns * 96)); height=$((rows * 128)); candidate="public/game/sheets/$name.png"
  if [[ "$check_only" != '--check' ]]; then
    candidate="$work/sheet.png"
    ffmpeg -v error -f rawvideo -pixel_format rgba -video_size "${width}x${height}" -i "$work/packed.raw" -frames:v 1 -c:v png -compression_level 9 -pred mixed -update 1 -y "$candidate"
  fi
  node - "$candidate" "$width" "$height" <<'NODE'
const fs = require('node:fs');
const [path, width, height] = process.argv.slice(2), data = fs.readFileSync(path);
if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || data.readUInt32BE(16) !== Number(width) || data.readUInt32BE(20) !== Number(height)) throw new Error(`Incorrect PNG sheet dimensions: ${path}`);
NODE
  ffmpeg -v error -i "$candidate" -frames:v 1 -f rawvideo -pix_fmt rgba -y "$work/decoded.raw"
  if ! cmp -s "$work/packed.raw" "$work/decoded.raw"; then echo "RGBA pixel mismatch: $candidate" >&2; exit 1; fi
  if [[ "$check_only" != '--check' ]]; then cp "$candidate" "public/game/sheets/$name.png"; fi
  source_bytes="$(cat "$work/source-bytes")"
  echo "public/game/sheets/$name.png: ${width}x${height}, $columns columns, ${#paths[@]} frames; $(wc -c < "$candidate" | tr -d ' ') bytes vs $source_bytes bytes in source PNGs; RGBA pixels match"
}

for variant in male female; do
  frames=()
  for direction in down left up right; do
    frames+=("public/game/characters/$variant/idle-$direction.png")
    for index in 0 1 2 3; do frames+=("public/game/characters/$variant/walk-$direction-$index.png"); done
  done
  frames+=("public/game/characters/$variant/blink-idle-down.png" "public/game/characters/$variant/blink-walk-down-1.png")
  build_sheet "$variant" 6 4 "${frames[@]}"
done
