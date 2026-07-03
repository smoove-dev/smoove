#!/usr/bin/env bash
# Scaffold every template from the local templates/ dir, install from the
# public npm registry, and build. Run before releases (slow: the studio
# template pulls skia-canvas + ffmpeg natives).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pnpm --filter create-smoove build

scaffold() {
  local name="$1"; shift
  echo "--- $name ---"
  SMOOVE_CREATE_TEMPLATE_DIR="$ROOT/templates" node "$ROOT/packages/create/dist/index.js" \
    "$@" "$TMP/$name" --no-git --no-skill --no-install
  (cd "$TMP/$name" && npm install --no-audit --no-fund && npm run build)
}

scaffold comp-ts composition --ts
scaffold comp-js composition --js
scaffold studio studio

echo "smoke-create: all templates scaffold, install, and build ✔"
