#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SOURCE_FILE="$ROOT_DIR/RO Rebuild Web Assist-4.57.0.js"
RELEASE_FILE="$ROOT_DIR/ro-rebuild-web-assist.user.js"

node --check "$SOURCE_FILE"
cp "$SOURCE_FILE" "$RELEASE_FILE"
node --check "$RELEASE_FILE"

printf 'Published %s\n' "$RELEASE_FILE"
