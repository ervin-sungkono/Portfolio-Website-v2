#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app="$root_dir/.tools/squashfs-root/AppRun"
if [[ ! -x "$app" ]]; then
  echo 'LibreSprite is not set up. Run: bash scripts/setup-libresprite.sh' >&2
  exit 1
fi
export XDG_CONFIG_HOME="$root_dir/.tools/config"
export XDG_CACHE_HOME="$root_dir/.tools/cache"
export XDG_RUNTIME_DIR="${TMPDIR:-/tmp}/portfolio-art-runtime-$(id -u)"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
exec "$app" "$@"
