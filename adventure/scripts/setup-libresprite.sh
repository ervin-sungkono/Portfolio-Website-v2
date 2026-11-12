#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tools_dir="$root_dir/.tools"
appimage="$tools_dir/libresprite-v1.3-linux-x86_64.AppImage"
expected_sha='fd90bddda8135fe00f4a9a9c8c9ebd48f9b07e8782ab269be5c9efb1a851af30'
url='https://github.com/LibreSprite/LibreSprite/releases/download/v1.3/libresprite-v1.3-linux-x86_64.AppImage'
mkdir -p "$tools_dir"
if [[ ! -f "$appimage" ]]; then
  temp_file="$(mktemp "$tools_dir/libresprite-download.XXXXXX")"
  trap 'rm -f "$temp_file"' EXIT
  curl -fL --retry 2 --connect-timeout 20 -o "$temp_file" "$url"
  printf '%s  %s\n' "$expected_sha" "$temp_file" | sha256sum -c -
  mv "$temp_file" "$appimage"
  trap - EXIT
fi
printf '%s  %s\n' "$expected_sha" "$appimage" | sha256sum -c -
chmod u+x "$appimage"
if [[ ! -x "$tools_dir/squashfs-root/AppRun" ]]; then
  (cd "$tools_dir" && "$appimage" --appimage-extract >/dev/null)
fi
echo "LibreSprite is ready: bash scripts/libresprite.sh --help"
