#!/usr/bin/env bash
# Verify standalone bundle assembly: build all service bundles, Dockerfile checks, smoke.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STANDALONE_SERVICES=(
  "packages/core:@conduitplatform/core"
  "modules/database:@conduitplatform/database"
  "modules/router:@conduitplatform/router"
  "modules/authentication:@conduitplatform/authentication"
  "modules/authorization:@conduitplatform/authorization"
  "modules/communications:@conduitplatform/communications"
  "modules/storage:@conduitplatform/storage"
  "modules/chat:@conduitplatform/chat"
)

TMP="$(mktemp -d)"
trap 'cleanup_all' EXIT

REDIS_PID=""
REDIS_CONTAINER=""
CORE_PID=""

cleanup_all() {
  if [ -n "$CORE_PID" ] && kill -0 "$CORE_PID" 2>/dev/null; then
    kill "$CORE_PID" 2>/dev/null || true
    wait "$CORE_PID" 2>/dev/null || true
  fi
  if [ -n "$REDIS_CONTAINER" ]; then
    docker rm -f "$REDIS_CONTAINER" >/dev/null 2>&1 || true
  fi
  if [ -n "$REDIS_PID" ] && kill -0 "$REDIS_PID" 2>/dev/null; then
    kill "$REDIS_PID" 2>/dev/null || true
    wait "$REDIS_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP"
}

source ~/.nvm/nvm.sh >/dev/null 2>&1 || true
nvm use >/dev/null 2>&1 || true

echo "==> Building all standalone service bundles"
for entry in "${STANDALONE_SERVICES[@]}"; do
  pkg="${entry#*:}"
  echo "    $pkg"
  pnpm exec turbo run build --filter="${pkg}..." >/dev/null
  pnpm --filter "$pkg" run build:bundle
done

for entry in "${STANDALONE_SERVICES[@]}"; do
  dir="${entry%%:*}"
  if [ ! -f "$ROOT/$dir/bundle/index.js" ]; then
    echo "FAIL: missing $ROOT/$dir/bundle/index.js" >&2
    exit 1
  fi
done

DOCKERFILE_STANDALONE="$ROOT/standalone.Dockerfile"
INSTALL_SCRIPT="$ROOT/standalone/install-bundle-service.sh"

echo "==> Checking standalone.Dockerfile hermes layout (no /app/libraries symlinks)"
if [ ! -f "$DOCKERFILE_STANDALONE" ]; then
  echo "FAIL: missing $DOCKERFILE_STANDALONE" >&2
  exit 1
fi
if rg -q 'ln -sf /app/libraries/(hermes|grpc-sdk)' "$DOCKERFILE_STANDALONE" 2>/dev/null; then
  echo "FAIL: standalone.Dockerfile must not symlink hermes/grpc-sdk to /app/libraries" >&2
  exit 1
fi
if ! rg -q 'libraries/hermes' "$DOCKERFILE_STANDALONE" 2>/dev/null; then
  echo "FAIL: standalone.Dockerfile must COPY hermes from conduit-base" >&2
  exit 1
fi
if ! rg -q 'node_modules/@conduitplatform/hermes' "$INSTALL_SCRIPT" 2>/dev/null; then
  echo "FAIL: install-bundle-service.sh must nest hermes under node_modules/@conduitplatform/hermes" >&2
  exit 1
fi

echo "==> Assembling temp standalone runtime (per-service npm ci)"
ASSEMBLY="$TMP/standalone-app"
mkdir -p "$ASSEMBLY/standalone" "$ASSEMBLY/libraries/hermes/dist" "$ASSEMBLY/libraries/grpc-sdk/dist"
cp "$INSTALL_SCRIPT" "$ASSEMBLY/standalone/install-bundle-service.sh"
chmod +x "$ASSEMBLY/standalone/install-bundle-service.sh"
cp "$ROOT/libraries/hermes/package.json" "$ASSEMBLY/libraries/hermes/"
cp -R "$ROOT/libraries/hermes/dist/." "$ASSEMBLY/libraries/hermes/dist/"
cp "$ROOT/libraries/grpc-sdk/package.json" "$ASSEMBLY/libraries/grpc-sdk/"
cp -R "$ROOT/libraries/grpc-sdk/dist/." "$ASSEMBLY/libraries/grpc-sdk/dist/"

for entry in "${STANDALONE_SERVICES[@]}"; do
  dir="${entry%%:*}"
  mkdir -p "$ASSEMBLY/$dir/bundle"
  cp -R "$ROOT/$dir/bundle/." "$ASSEMBLY/$dir/bundle/"
  cp "$ROOT/$dir/package.bundle.json" "$ASSEMBLY/$dir/package.json"
  cp "$ROOT/$dir/package.bundle-lock.json" "$ASSEMBLY/$dir/package-lock.json"
done

(
  cd "$ASSEMBLY"
  for entry in "${STANDALONE_SERVICES[@]}"; do
    dir="${entry%%:*}"
    sh ./standalone/install-bundle-service.sh "$dir" ./libraries
  done
)

start_redis_for_smoke() {
  if command -v redis-server >/dev/null 2>&1; then
    redis-server --port 6379 --save "" --appendonly no --daemonize no \
      --logfile "$TMP/redis.log" --dir "$TMP" &
    REDIS_PID=$!
    for _ in $(seq 1 30); do
      if redis-cli -p 6379 ping >/dev/null 2>&1; then
        return 0
      fi
      sleep 0.2
    done
    return 1
  fi

  if command -v docker >/dev/null 2>&1; then
    REDIS_CONTAINER="conduit-standalone-bundle-smoke-redis-$$"
    docker rm -f "$REDIS_CONTAINER" >/dev/null 2>&1 || true
    docker run -d --name "$REDIS_CONTAINER" -p 6379:6379 redis:7-alpine >/dev/null
    for _ in $(seq 1 30); do
      if docker exec "$REDIS_CONTAINER" redis-cli ping >/dev/null 2>&1; then
        return 0
      fi
      sleep 0.2
    done
    return 1
  fi

  return 1
}

echo "==> Smoke: core (expect gRPC server listening) + chat module (expect Waiting for Core)"
if ! start_redis_for_smoke; then
  echo "FAIL: could not start Redis for standalone smoke" >&2
  exit 1
fi

CORE_LOG="$TMP/core.log"
CHAT_LOG="$TMP/chat.log"

(
  cd "$ASSEMBLY"
  env REDIS_HOST=127.0.0.1 REDIS_PORT=6379 GRPC_PORT=55152 NODE_ENV=production \
    node packages/core/bundle/index.js
) >"$CORE_LOG" 2>&1 &
CORE_PID=$!

for _ in $(seq 1 50); do
  if rg -q 'gRPC server listening' "$CORE_LOG" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$CORE_PID" 2>/dev/null; then
    echo "FAIL: core exited before gRPC listen" >&2
    cat "$CORE_LOG" >&2
    exit 1
  fi
  sleep 0.3
done

if ! rg -q 'gRPC server listening' "$CORE_LOG" 2>/dev/null; then
  echo "FAIL: core did not reach 'gRPC server listening'" >&2
  cat "$CORE_LOG" >&2
  exit 1
fi

run_with_timeout() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@" || true
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$seconds" "$@" || true
  else
    perl -e 'alarm shift; exec @ARGV' "$seconds" "$@" || true
  fi
}

run_with_timeout 10 env CONDUIT_SERVER=127.0.0.1:55152 GRPC_PORT=55170 NODE_ENV=production \
  node "$ASSEMBLY/modules/chat/bundle/index.js" >"$CHAT_LOG" 2>&1

if rg -q 'Dynamic require of "fs" is not supported' "$CHAT_LOG" 2>/dev/null; then
  echo "FAIL: chat module dynamic require crash" >&2
  cat "$CHAT_LOG" >&2
  exit 1
fi

if ! rg -q 'Waiting for Core' "$CHAT_LOG" 2>/dev/null; then
  echo "FAIL: chat module did not reach 'Waiting for Core'" >&2
  cat "$CHAT_LOG" >&2
  exit 1
fi

echo "PASS: standalone bundle verified"
