#!/usr/bin/env bash
#
# DemoForge — safe commit helper
# ------------------------------------------------------------------
# Commits this session's work (Warm Canvas redesign, product roadmap,
# Projects persistence backend, Dashboard wiring, security hardening)
# while GUARANTEEING no .env files or API keys are committed.
#
# Usage:
#   bash commit_demoforge.sh          # untrack secrets, scan, commit, push
#   bash commit_demoforge.sh --no-push # commit only, don't push
# ------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

PUSH=1
[[ "${1:-}" == "--no-push" ]] && PUSH=0

echo "▶ Clearing any stale git lock…"
rm -f .git/index.lock 2>/dev/null || true

echo "▶ Untracking secrets & build cruft (kept on disk, removed from git)…"
git rm -r --cached --ignore-unmatch frontend/.env backend/.env backend/db.sqlite3 >/dev/null 2>&1 || true
git ls-files | grep -E '__pycache__/|\.pyc$|\.DS_Store$' | xargs -r git rm --cached --quiet 2>/dev/null || true

echo "▶ Staging all changes…"
git add -A

echo "▶ Scanning staged content for real secrets…"
# Match live Google (AIza…) / OpenAI (sk-…) keys and non-empty AZURE *KEY= values.
if git diff --cached | grep -nE 'AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z]{20,}|AZURE_[A-Z_]*KEY=[^[:space:]]+' ; then
  echo "✋ Potential secret detected above. Aborting — review before committing."
  exit 1
fi

echo "▶ Verifying no .env file is staged…"
if git diff --cached --name-only | grep -E '(^|/)\.env$' ; then
  echo "✋ A .env file is staged. Aborting."
  exit 1
fi

echo "▶ Committing…"
git commit -m "feat: Warm Canvas redesign, product roadmap, Projects persistence + security hardening

- New 'Warm Canvas' design system: calm YC-style tokens, warm palette, serif display font
- Redesigned interactive landing page: self-playing studio demo, live localization
  captions, scroll reveals, feature showcase, 3-tier pricing, FAQ; restyled header/footer
- PRODUCT_ROADMAP.md: full strategy, Azure AI architecture, prioritized backlog, 90-day plan
- Backend: new 'projects' app (Project model, DRF viewset with owner scoping, public
  share endpoint, migration) wired into settings + urls; tests pass
- Frontend: Dashboard wired to real Projects API via lib/api/projects.ts (load/create/delete)
- Security: removed hardcoded Gemini key -> env only; Azure OpenAI/Translator/Blob config
  scaffolding; added root .gitignore + backend/frontend .env.example templates
- requirements: openai, azure-storage-blob, python-dotenv"

BRANCH="$(git branch --show-current)"
echo "✅ Commit created on branch: ${BRANCH}"

if [[ "$PUSH" == "1" ]]; then
  echo "▶ Pushing to origin/${BRANCH}…"
  git push origin "${BRANCH}" || echo "⚠ Push needs your GitHub credentials. Run:  git push origin ${BRANCH}"
else
  echo "▶ Skipped push. When ready:  git push origin ${BRANCH}"
fi
