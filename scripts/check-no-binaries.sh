#!/usr/bin/env bash
set -euo pipefail

ALLOWLIST_REGEX='^frontend/public/icons/.*\.svg$'

MODE="${1:-remote}"
BASE_REF="${2:-origin/main}"

if ! command -v file >/dev/null 2>&1; then
  echo "The 'file' utility is required to detect binary assets. Install it (e.g. \'brew install file-formula\' or \'apt install file\')." >&2
  exit 1
fi

if [ "$MODE" = "--staged" ]; then
  FILES=$(git diff --cached --name-only --diff-filter=AM)
else
  FILES=$(git diff --name-only --diff-filter=AM "$BASE_REF"...HEAD || true)
fi

if [ -z "$FILES" ]; then
  exit 0
fi

FILTERED=$(echo "$FILES" | grep -vE "$ALLOWLIST_REGEX" || true)

if [ -z "$FILTERED" ]; then
  exit 0
fi

echo "Inspecting files:" >&2
printf '%s\n' "$FILTERED" >&2

BINARY_FOUND=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  INFO=$(file -I "$file")
  echo "$INFO"
  if echo "$INFO" | grep -q 'charset=binary'; then
    echo "Binary file detected: $file" >&2
    BINARY_FOUND=1
  fi
done <<< "$FILTERED"

if [ "$BINARY_FOUND" -ne 0 ]; then
  exit 1
fi
