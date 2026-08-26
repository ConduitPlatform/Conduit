#!/usr/bin/env sh
# Install one bundled service runtime tree (npm ci + optional native rebuilds + hermes).
# Used by standalone.Dockerfile and verify-standalone-bundle.sh.
# Caller must run from the app root (/app in Docker, assembly dir in verify).
set -eu

SERVICE_ARG="$1"
HERMES_ROOT="${2:-}"

case "$SERVICE_ARG" in
  /*)
    SERVICE_DIR="$SERVICE_ARG"
    REL_DIR="${SERVICE_ARG#/app/}"
    ;;
  *)
    REL_DIR="$SERVICE_ARG"
    SERVICE_DIR="$(cd "$SERVICE_ARG" && pwd)"
    ;;
esac

BCRYPT_SERVICES="packages/core modules/authentication modules/authorization modules/communications modules/router"
SQLITE_SERVICES="modules/database"
HERMES_SERVICES="packages/core modules/router"

if [ ! -f "$SERVICE_DIR/package.json" ] || [ ! -f "$SERVICE_DIR/package-lock.json" ]; then
  echo "install-bundle-service: missing package.json or package-lock.json in $SERVICE_DIR" >&2
  exit 1
fi

if [ -n "$HERMES_ROOT" ]; then
  case "$HERMES_ROOT" in
    /*) ;;
    *) HERMES_ROOT="$(cd "$HERMES_ROOT" && pwd)" ;;
  esac
  if [ ! -f "$HERMES_ROOT/hermes/package.json" ]; then
    echo "install-bundle-service: missing $HERMES_ROOT/hermes/package.json" >&2
    exit 1
  fi
fi

cd "$SERVICE_DIR"
npm ci --omit=dev --ignore-scripts --silent

case " $BCRYPT_SERVICES " in
  *" $REL_DIR "*) npm rebuild bcrypt --silent ;;
esac

case " $SQLITE_SERVICES " in
  *" $REL_DIR "*) npm rebuild sqlite3 --silent ;;
esac

case " $HERMES_SERVICES " in
  *" $REL_DIR "*)
    if [ -z "$HERMES_ROOT" ]; then
      echo "install-bundle-service: HERMES_ROOT required for $REL_DIR" >&2
      exit 1
    fi
    mkdir -p node_modules/@conduitplatform/hermes/dist node_modules/@conduitplatform/grpc-sdk/dist
    cp "$HERMES_ROOT/hermes/package.json" node_modules/@conduitplatform/hermes/
    cp -R "$HERMES_ROOT/hermes/dist/." node_modules/@conduitplatform/hermes/dist/
    mkdir -p node_modules/@conduitplatform/hermes/dist/public
    cp "$HERMES_ROOT/grpc-sdk/package.json" node_modules/@conduitplatform/grpc-sdk/
    cp -R "$HERMES_ROOT/grpc-sdk/dist/." node_modules/@conduitplatform/grpc-sdk/dist/
    ;;
esac
