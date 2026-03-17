#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-append}"
EXPORT_DIR="${2:-.convex-export}"

case "$MODE" in
  append)
    CONVEX_FLAG="--append"
    ;;
  replace)
    CONVEX_FLAG="--replace"
    ;;
  *)
    echo "Usage: $0 [append|replace] [export_dir]" >&2
    exit 1
    ;;
esac

if [ ! -d "$EXPORT_DIR" ]; then
  echo "Export directory not found: $EXPORT_DIR" >&2
  exit 1
fi

shopt -s nullglob
FILES=("$EXPORT_DIR"/*.jsonl)

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No .jsonl files found in $EXPORT_DIR" >&2
  exit 1
fi

for file in "${FILES[@]}"; do
  table="$(basename "$file" .jsonl)"
  echo "Importing $table from $file"
  npx convex import --table "$table" $CONVEX_FLAG -y "$file"
done
