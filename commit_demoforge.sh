#!/usr/bin/env bash
#
# DemoForge — safe commit helper
# ------------------------------------------------------------------
# Untracks secrets, runs secret scan, commits. Does NOT push unless asked.
#
# Usage:
#   bash commit_demoforge.sh            # scan + commit
#   bash commit_demoforge.sh --push     # scan + commit + push
# ------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

PUSH=0
[[ "${1:-}" == "--push" ]] && PUSH=1

echo "▶ Installing git hooks (if needed)…"
bash scripts/install-git-hooks.sh

echo "▶ Clearing any stale git lock…"
rm -f .git/index.lock 2>/dev/null || true

echo "▶ Untracking secrets & local artifacts (kept on disk)…"
git rm -r --cached --ignore-unmatch \
  frontend/.env \
  frontend/.env.local \
  backend/.env \
  backend/db.sqlite3 \
  deploy.zip \
  backend/.azure/ \
  .vercel/ \
  >/dev/null 2>&1 || true

git ls-files -z | grep -zE '__pycache__/|\.pyc$|\.DS_Store$|vite\.config\.ts\.timestamp-' \
  | xargs -0 -r git rm --cached --quiet 2>/dev/null || true

echo "▶ Verifying nothing sensitive remains tracked…"
bash scripts/check-secrets.sh --all

echo "▶ Staging changes…"
git add -A

echo "▶ Pre-commit secret scan…"
bash scripts/check-secrets.sh

MSG="${COMMIT_MSG:-feat: update DemoForge editor, deployment, and security hardening}"
echo "▶ Committing…"
git commit -m "$(cat <<EOF
${MSG}

EOF
)"

BRANCH="$(git branch --show-current)"
echo "✅ Commit created on branch: ${BRANCH}"

if [[ "$PUSH" == "1" ]]; then
  echo "▶ Pushing to origin/${BRANCH}…"
  git push origin "${BRANCH}"
else
  echo "▶ Skipped push. When ready: git push origin ${BRANCH}"
fi
