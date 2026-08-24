#!/usr/bin/env bash
# Verify a Conduit service bundle: build, proto layout, no bad requires, smoke start.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SERVICE="${1:-}"
if [ -z "$SERVICE" ]; then
  echo "Usage: $0 <service>" >&2
  echo "Example: $0 chat" >&2
  exit 1
fi

SMOKE_TIMEOUT=8
SMOKE_SUCCESS_PATTERN='Waiting for Core'

case "$SERVICE" in
  chat)
    PKG="@conduitplatform/chat"
    SERVICE_DIR="$ROOT/modules/$SERVICE"
    SERVICE_PROTOS="chat.proto"
    ;;
  functions)
    PKG="@conduitplatform/functions"
    SERVICE_DIR="$ROOT/modules/$SERVICE"
    SERVICE_PROTOS=""
    ;;
  storage)
    PKG="@conduitplatform/storage"
    SERVICE_DIR="$ROOT/modules/$SERVICE"
    SERVICE_PROTOS="storage.proto"
    ;;
  authentication)
    PKG="@conduitplatform/authentication"
    SERVICE_DIR="$ROOT/modules/$SERVICE"
    SERVICE_PROTOS="authentication.proto"
    ;;
  authorization)
    PKG="@conduitplatform/authorization"
    SERVICE_DIR="$ROOT/modules/$SERVICE"
    SERVICE_PROTOS="authorization.proto"
    ;;
  communications)
    PKG="@conduitplatform/communications"
    SERVICE_DIR="$ROOT/modules/$SERVICE"
    SERVICE_PROTOS="communications.proto"
    ;;
  database)
    PKG="@conduitplatform/database"
    SERVICE_DIR="$ROOT/modules/$SERVICE"
    SERVICE_PROTOS="database.proto"
    ;;
  router)
    PKG="@conduitplatform/router"
    SERVICE_DIR="$ROOT/modules/$SERVICE"
    SERVICE_PROTOS="router.proto"
    ;;
  core)
    PKG="@conduitplatform/core"
    SERVICE_DIR="$ROOT/packages/core"
    SERVICE_PROTOS="core.proto"
    SMOKE_TIMEOUT=15
    SMOKE_SUCCESS_PATTERN='gRPC server listening'
    ;;
  *)
    echo "Unknown service: $SERVICE" >&2
    exit 1
    ;;
esac

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

source ~/.nvm/nvm.sh >/dev/null 2>&1 || true
nvm use >/dev/null 2>&1 || true

echo "==> Building $PKG (tsc + bundle)"
pnpm exec turbo run build --filter="${PKG}..." >/dev/null
pnpm --filter "$PKG" run build:bundle

BUNDLE_DIR="$SERVICE_DIR/bundle"
if [ ! -f "$BUNDLE_DIR/index.js" ]; then
  echo "FAIL: missing $BUNDLE_DIR/index.js" >&2
  exit 1
fi

echo "==> Checking protos in bundle/ (flat layout)"
for proto in $SERVICE_PROTOS module.proto grpc_health_check.proto; do
  if [ ! -f "$BUNDLE_DIR/$proto" ]; then
    echo "FAIL: missing $BUNDLE_DIR/$proto" >&2
    exit 1
  fi
done

install_hermes_external_packages() {
  local dest_root="$1"
  local hermes_dest="$dest_root/node_modules/@conduitplatform/hermes"
  local grpc_dest="$dest_root/node_modules/@conduitplatform/grpc-sdk"
  mkdir -p "$hermes_dest/dist" "$grpc_dest/dist"
  cp "$ROOT/libraries/hermes/package.json" "$hermes_dest/"
  cp -R "$ROOT/libraries/hermes/dist/." "$hermes_dest/dist/"
  mkdir -p "$hermes_dest/dist/public"
  cp "$ROOT/libraries/grpc-sdk/package.json" "$grpc_dest/"
  cp -R "$ROOT/libraries/grpc-sdk/dist/." "$grpc_dest/dist/"
}

check_hermes_dockerfile_layout() {
  local dockerfile="$1"
  if [ ! -f "$dockerfile" ]; then
    echo "FAIL: missing $dockerfile" >&2
    exit 1
  fi
  if rg -q 'ln -sf /app/libraries/(hermes|grpc-sdk)' "$dockerfile" 2>/dev/null; then
    echo "FAIL: $dockerfile must not symlink hermes/grpc-sdk to /app/libraries (ESM realpath breaks dep resolution)" >&2
    exit 1
  fi
  if ! rg -q 'node_modules/@conduitplatform/hermes' "$dockerfile" 2>/dev/null; then
    echo "FAIL: $dockerfile must COPY hermes into node_modules/@conduitplatform/hermes" >&2
    exit 1
  fi
}

if [ "$SERVICE" = "router" ]; then
  echo "==> Checking router Dockerfile hermes layout (no /app/libraries symlinks)"
  check_hermes_dockerfile_layout "$SERVICE_DIR/Dockerfile"
fi

if [ "$SERVICE" = "core" ]; then
  echo "==> Checking core Dockerfile hermes layout (no /app/libraries symlinks)"
  check_hermes_dockerfile_layout "$SERVICE_DIR/Dockerfile"
fi

echo "==> Checking keepNames so Class.name schema registrations stay stable"
if rg -q 'class _[A-Za-z0-9]+ extends ConduitActiveSchema' "$BUNDLE_DIR/index.js"; then
  if ! rg -q '__name\(' "$BUNDLE_DIR/index.js"; then
    echo "FAIL: ConduitActiveSchema classes were renamed without keepNames; schema names become _User/_ChatRoom and cross-module relations break" >&2
    exit 1
  fi
fi

echo "==> Scanning bundle for known-bad dynamic require patterns"
BAD=0
if rg -q '__require\("@grpc/' "$BUNDLE_DIR" 2>/dev/null; then
  echo "FAIL: found __require(\"@grpc/...\") in bundle" >&2
  rg '__require\("@grpc/' "$BUNDLE_DIR" || true
  BAD=1
fi
if rg -q '__require\("fs"\)' "$BUNDLE_DIR" 2>/dev/null; then
  echo "FAIL: found __require(\"fs\") in bundle" >&2
  rg '__require\("fs"\)' "$BUNDLE_DIR" || true
  BAD=1
fi
if [ "$BAD" -ne 0 ]; then
  exit 1
fi

echo "==> Temp-dir smoke: npm ci + node (expect: $SMOKE_SUCCESS_PATTERN)"
SMOKE_DIR="$TMP/smoke"
mkdir -p "$SMOKE_DIR/bundle"
cp -R "$BUNDLE_DIR/." "$SMOKE_DIR/bundle/"
cp "$SERVICE_DIR/package.bundle.json" "$SMOKE_DIR/package.json"
cp "$SERVICE_DIR/package.bundle-lock.json" "$SMOKE_DIR/package-lock.json"
(
  cd "$SMOKE_DIR"
  npm ci --omit=dev --ignore-scripts --silent
  if [ "$SERVICE" = "authentication" ] || [ "$SERVICE" = "authorization" ] || [ "$SERVICE" = "communications" ] || [ "$SERVICE" = "router" ] || [ "$SERVICE" = "core" ]; then
    npm rebuild bcrypt --silent
  fi
  if [ "$SERVICE" = "database" ]; then
    npm rebuild sqlite3 --silent
  fi
  if [ "$SERVICE" = "router" ] || [ "$SERVICE" = "core" ]; then
    install_hermes_external_packages "$SMOKE_DIR"
  fi
)

REDIS_PID=""
REDIS_CONTAINER=""
cleanup_redis() {
  if [ -n "$REDIS_CONTAINER" ]; then
    docker rm -f "$REDIS_CONTAINER" >/dev/null 2>&1 || true
    REDIS_CONTAINER=""
  fi
  if [ -n "$REDIS_PID" ] && kill -0 "$REDIS_PID" 2>/dev/null; then
    kill "$REDIS_PID" 2>/dev/null || true
    wait "$REDIS_PID" 2>/dev/null || true
  fi
}

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
    REDIS_CONTAINER="conduit-bundle-smoke-redis-$$"
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

if [ "$SERVICE" = "core" ]; then
  if ! start_redis_for_smoke; then
    echo "WARN: could not start Redis; core smoke may fail before gRPC listen" >&2
  fi
  trap 'cleanup_redis; rm -rf "$TMP"' EXIT
fi

SMOKE_LOG="$TMP/smoke.log"
run_with_timeout() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@" >"$SMOKE_LOG" 2>&1 || true
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$seconds" "$@" >"$SMOKE_LOG" 2>&1 || true
  else
    perl -e 'alarm shift; exec @ARGV' "$seconds" "$@" >"$SMOKE_LOG" 2>&1 || true
  fi
}

SMOKE_ENV=(CONDUIT_SERVER=127.0.0.1:55152)
if [ "$SERVICE" = "core" ]; then
  SMOKE_ENV+=(REDIS_HOST=127.0.0.1 REDIS_PORT=6379 GRPC_PORT=55152)
fi

run_with_timeout "$SMOKE_TIMEOUT" env "${SMOKE_ENV[@]}" node "$SMOKE_DIR/bundle/index.js"

if rg -q 'Dynamic require of "fs" is not supported' "$SMOKE_LOG" 2>/dev/null; then
  echo "FAIL: Dynamic require crash on smoke start" >&2
  cat "$SMOKE_LOG" >&2
  exit 1
fi

if ! rg -q "$SMOKE_SUCCESS_PATTERN" "$SMOKE_LOG" 2>/dev/null; then
  echo "FAIL: smoke start did not reach '$SMOKE_SUCCESS_PATTERN'" >&2
  cat "$SMOKE_LOG" >&2
  exit 1
fi

echo "PASS: $SERVICE bundle verified"
