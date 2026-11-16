#!/bin/sh
set -eu
node_binary=${HOT_COMPRESS_NODE:-node}
if ! command -v "$node_binary" >/dev/null 2>&1; then
  for candidate in "/Applications/Hot Compress.app/Contents/Resources/runtime/node" "$HOME/Applications/Hot Compress.app/Contents/Resources/runtime/node"; do
    if [ -x "$candidate" ]; then node_binary=$candidate; break; fi
  done
fi
if [ -n "${HOT_COMPRESS_HOME:-}" ]; then
  exec "$node_binary" "$HOT_COMPRESS_HOME/bin/hot-compress.mjs" "$@"
fi
skill_directory=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ -f "$skill_directory/resources/engine/bin/hot-compress.mjs" ]; then
  exec "$node_binary" "$skill_directory/resources/engine/bin/hot-compress.mjs" "$@"
fi
if [ -f "$skill_directory/engine-path" ]; then
  engine_directory=$(cat "$skill_directory/engine-path")
else
  engine_directory=$(CDPATH= cd -- "$skill_directory/../.." && pwd)
fi
if [ -f "$engine_directory/bin/hot-compress.mjs" ]; then
  exec "$node_binary" "$engine_directory/bin/hot-compress.mjs" "$@"
fi
if command -v hot-compress >/dev/null 2>&1; then exec hot-compress "$@"; fi
printf '%s\n' 'Set HOT_COMPRESS_HOME to the Hot Compress repository and run npm ci && npm run build.' >&2
exit 1
