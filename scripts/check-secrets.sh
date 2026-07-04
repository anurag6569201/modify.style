#!/usr/bin/env bash
# Scan staged git content for common secret patterns before commit/push.
# Usage:
#   bash scripts/check-secrets.sh           # scan staged diff
#   bash scripts/check-secrets.sh --all     # scan entire working tree (tracked files)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[1;33m'
NC='\033[0m'

fail=0

# Files that define secret patterns — never scan their content
should_skip_file() {
  case "$1" in
    scripts/check-secrets.sh|commit_demoforge.sh|.githooks/*|*.env.example|*/.env.example)
      return 0 ;;
  esac
  return 1
}

echo "▶ Checking for forbidden files…"
if [[ "${1:-}" == "--all" ]]; then
  for f in '.env' 'backend/.env' 'frontend/.env' 'frontend/.env.local' 'backend/db.sqlite3' 'deploy.zip'; do
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      echo -e "${RED}✋ Tracked secret/build file: ${f}${NC}"
      echo "   Run: git rm --cached ${f}"
      fail=1
    fi
  done
else
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    # Block newly added env files (deletions/untracks are OK)
    if [[ "$path" == *"/.env" ]] || [[ "$path" == *".env.local" ]] || [[ "$(basename "$path")" == ".env" ]]; then
      if git diff --cached --diff-filter=A --name-only | grep -qxF "$path"; then
        echo -e "${RED}✋ Staged env file (new): ${path}${NC}"
        fail=1
      fi
    fi
    if git diff --cached --diff-filter=A --name-only | grep -qxF "$path"; then
      if [[ "$path" == "backend/db.sqlite3" ]] || [[ "$path" == "deploy.zip" ]]; then
        echo -e "${RED}✋ Staged local artifact: ${path}${NC}"
        fail=1
      fi
    fi
  done < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
fi

echo "▶ Scanning content for secret patterns…"

# Real secret values only — not regex definitions or placeholder names
VALUE_PATTERNS=(
  'AIza[0-9A-Za-z_-]{20,}'
  'sk-[0-9A-Za-z]{20,}'
  'sk-proj-[0-9A-Za-z_-]{20,}'
  'xox[baprs]-[0-9A-Za-z-]{10,}'
  'ghp_[0-9A-Za-z]{20,}'
  'gho_[0-9A-Za-z]{20,}'
  'AccountKey=[A-Za-z0-9+/=]{30,}'
  'DefaultEndpointsProtocol=https;[^[:space:]]*AccountKey=[A-Za-z0-9+/=]{30,}'
  'postgres(ql)?://[^[:space:]/]+:[^@[:space:]]+@[^[:space:]]+'
  'DJANGO_SECRET_KEY=[^[:space:]]{8,}'
  'AZURE_[A-Z_]*KEY=[^[:space:]]{8,}'
  'GOOGLE_GEMINI_API_KEY=[^[:space:]]{8,}'
  'VERCEL_OIDC_TOKEN="eyJ'
  'Bearer eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.'
)

scan_added_lines() {
  local file="$1"
  local content="$2"
  local hits
  hits="$(echo "$content" | grep -nE "$(IFS='|'; echo "${VALUE_PATTERNS[*]}")" 2>/dev/null \
    | grep -vE 'change-me-in-production|your-resource|<your-|<resource>|user:pass@host|# ' || true)"
  if [[ -n "$hits" ]]; then
    echo -e "${RED}✋ Potential secret in ${file}:${NC}"
    echo "$hits" | head -15
    fail=1
  fi
}

if [[ "${1:-}" == "--all" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    should_skip_file "$f" && continue
    [[ -f "$f" ]] || continue
    scan_added_lines "$f" "$(cat "$f")"
  done < <(git ls-files)
else
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    should_skip_file "$path" && continue
    added="$(git diff --cached -U0 -- "$path" 2>/dev/null | grep '^+' | grep -v '^+++' || true)"
    [[ -z "$added" ]] && continue
    scan_added_lines "$path" "$added"
  done < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
fi

# Warn if hardcoded Google OAuth client ID is added in app source (not env templates)
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  should_skip_file "$path" && continue
  case "$path" in
    *.tsx|*.ts|*.jsx|*.js|*.py)
      added="$(git diff --cached -U0 -- "$path" 2>/dev/null | grep '^+' | grep -v '^+++' || true)"
      if echo "$added" | grep -qE '[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com'; then
        echo -e "${YLW}⚠ Hardcoded Google client ID added in ${path} — use VITE_GOOGLE_CLIENT_ID env var.${NC}"
        fail=1
      fi
      ;;
  esac
done < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo -e "${RED}Commit blocked — remove secrets before pushing.${NC}"
  echo "Tips:"
  echo "  • Keep secrets in backend/.env and frontend/.env (gitignored)"
  echo "  • Copy from *.env.example templates"
  echo "  • Untrack leaked files: git rm --cached <file>"
  exit 1
fi

echo -e "${GRN}✓ No secrets detected${NC}"
exit 0
