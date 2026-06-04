#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-database}"
BUILDING_SERVICE="${BUILDING_SERVICE:-}"

case "$TARGET" in
  conduit) BUILDING_SERVICE="conduit" ;;
  authentication) BUILDING_SERVICE="modules/authentication" ;;
  authorization) BUILDING_SERVICE="modules/authorization" ;;
  chat) BUILDING_SERVICE="modules/chat" ;;
  communications) BUILDING_SERVICE="modules/communications" ;;
  database) BUILDING_SERVICE="modules/database" ;;
  functions) BUILDING_SERVICE="modules/functions" ;;
  router) BUILDING_SERVICE="modules/router" ;;
  storage) BUILDING_SERVICE="modules/storage" ;;
  conduit-standalone) BUILDING_SERVICE="" ;;
  all) ;;
  *)
    echo "Unknown target: $TARGET" >&2
    echo "Usage: $0 [conduit|authentication|authorization|chat|communications|database|functions|router|storage|conduit-standalone|all]" >&2
    exit 1
    ;;
esac

if ! docker buildx version >/dev/null 2>&1; then
  echo "docker buildx is required" >&2
  exit 1
fi

BUILDER_NAME="${BUILDX_BUILDER:-conduit-multi}"
if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  docker buildx create --name "$BUILDER_NAME" --driver docker-container --use
  docker buildx inspect --bootstrap "$BUILDER_NAME" >/dev/null
else
  docker buildx use "$BUILDER_NAME"
fi

if [ "$TARGET" = "all" ]; then
  docker buildx bake --file docker-bake.hcl all --set "*.platform=linux/amd64,linux/arm64"
else
  docker buildx bake --file docker-bake.hcl "$TARGET" \
    --set "conduit-base.args.BUILDING_SERVICE=${BUILDING_SERVICE}" \
    --set "*.platform=linux/amd64,linux/arm64"
fi
