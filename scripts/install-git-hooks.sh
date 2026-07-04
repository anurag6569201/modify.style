#!/usr/bin/env bash
# Point this repo at .githooks/ so pre-commit secret scanning runs automatically.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

chmod +x scripts/check-secrets.sh
chmod +x .githooks/pre-commit

git config core.hooksPath .githooks
echo "✓ Git hooks installed (core.hooksPath=.githooks)"
echo "  Pre-commit will run scripts/check-secrets.sh on every commit."
