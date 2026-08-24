#!/usr/bin/env bash
# Compare tsc+prod-style footprint vs bundled chat artifacts (local, no Docker required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHAT="$ROOT/modules/chat"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$ROOT"
source ~/.nvm/nvm.sh >/dev/null 2>&1 || true
nvm use >/dev/null 2>&1 || true

echo "==> Building libraries + chat (tsc) and chat bundle"
pnpm exec turbo run build --filter=@conduitplatform/chat... >/dev/null
pnpm --filter @conduitplatform/chat run build:bundle

du_kb() {
  du -sk "$1" | awk '{print $1}'
}

human() {
  awk -v kb="$1" 'BEGIN {
    if (kb >= 1048576) printf "%.1fG", kb/1048576;
    else if (kb >= 1024) printf "%.1fM", kb/1024;
    else printf "%dK", kb;
  }'
}

echo "==> Measuring baseline: chat dist + workspace prod deps (approx via pnpm deploy)"
DEPLOY_DIR="$TMP/chat-deploy"
mkdir -p "$DEPLOY_DIR"
pnpm --filter @conduitplatform/chat deploy --prod --legacy "$DEPLOY_DIR" >/dev/null

BASE_DIST_KB="$(du_kb "$CHAT/dist")"
BASE_DEPLOY_KB="$(du_kb "$DEPLOY_DIR")"

echo "==> Measuring bundle: bundle/ + external-only node_modules"
BUNDLE_RUNTIME="$TMP/chat-bundle-runtime"
mkdir -p "$BUNDLE_RUNTIME"
cp -R "$CHAT/bundle" "$BUNDLE_RUNTIME/bundle"
cp "$CHAT/package.bundle.json" "$BUNDLE_RUNTIME/package.json"
(
  cd "$BUNDLE_RUNTIME"
  npm install --omit=dev --ignore-scripts --silent
)
BUNDLE_JS_KB="$(du_kb "$BUNDLE_RUNTIME/bundle")"
BUNDLE_TOTAL_KB="$(du_kb "$BUNDLE_RUNTIME")"

printf '\n=== Chat packaging footprint (local) ===\n'
printf '%-40s %10s\n' 'Artifact' 'Size'
printf '%-40s %10s\n' '----------------------------------------' '----------'
printf '%-40s %10s\n' 'tsc dist/' "$(human "$BASE_DIST_KB")"
printf '%-40s %10s\n' 'pnpm deploy --prod (approx image JS)' "$(human "$BASE_DEPLOY_KB")"
printf '%-40s %10s\n' 'bundle/ only' "$(human "$BUNDLE_JS_KB")"
printf '%-40s %10s\n' 'bundle + external node_modules' "$(human "$BUNDLE_TOTAL_KB")"

if [ "$BASE_DEPLOY_KB" -gt 0 ]; then
  SAVED=$((BASE_DEPLOY_KB - BUNDLE_TOTAL_KB))
  PCT=$(awk -v s="$SAVED" -v b="$BASE_DEPLOY_KB" 'BEGIN { printf "%.1f", (s/b)*100 }')
  printf '\nDelta vs pnpm deploy: %s (%s%%)\n' "$(human "$SAVED")" "$PCT"
fi

echo
echo "Note: Docker image size also includes alpine + node binary; run"
echo "  ./scripts/docker-build.sh chat"
echo "when Docker is available for full image comparison."
