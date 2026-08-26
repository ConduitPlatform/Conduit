FROM node:24

ARG BUILDING_SERVICE
ARG BUILD_BUNDLE=0

COPY . /app

WORKDIR /app

ARG PROTOC_VERSION=29.3
ARG TARGETARCH
RUN case "${TARGETARCH}" in \
      amd64) PROTOC_ARCH=x86_64 ;; \
      arm64) PROTOC_ARCH=aarch_64 ;; \
      *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2 && exit 1 ;; \
    esac && \
    curl -fsSL -o /tmp/protoc.zip \
      "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-${PROTOC_ARCH}.zip" && \
    unzip -o /tmp/protoc.zip -d /usr/local && \
    chmod +x /usr/local/bin/protoc && \
    rm -f /tmp/protoc.zip

RUN npm install -g node-gyp ts-proto pnpm@11.5.0

RUN pnpm install --frozen-lockfile --ignore-scripts && \
    pnpm rebuild @apollo/protobufjs @firebase/util bcrypt esbuild keccak msgpackr-extract protobufjs secp256k1 sqlite3 unrs-resolver vue-demi && \
    npx turbo run build --filter=@conduitplatform/grpc-sdk --filter=@conduitplatform/module-tools

RUN pnpm --filter @conduitplatform/service-bundle run build && \
    if [  -z "$BUILDING_SERVICE" ] ; then npx turbo run build ; \
    if [ "$BUILD_BUNDLE" = "1" ] ; then \
      for dir in packages/core modules/database modules/router modules/authentication modules/authorization modules/communications modules/storage modules/chat ; do \
        if [ -d "/app/$dir" ] && grep -q '"build:bundle"' "/app/$dir/package.json" 2>/dev/null ; then \
          (cd "/app/$dir" && pnpm run build:bundle) ; \
        fi ; \
      done ; \
    fi ; \
    elif [ "$BUILDING_SERVICE" = "conduit" ] ; then npx turbo run build --filter=@conduitplatform/core --filter=@conduitplatform/hermes \
    --filter=@conduitplatform/node-2fa; \
    elif [ "$BUILDING_SERVICE" = "modules/router" ] ; then npx turbo run build --filter=@conduitplatform/router \
    --filter=@conduitplatform/hermes; \
    elif [ "$BUILDING_SERVICE" = "modules/authentication" ] ; then npx turbo run build --filter=@conduitplatform/authentication \
    --filter=@conduitplatform/node-2fa; \
    elif echo "$BUILDING_SERVICE" | grep -q '^modules/' ; then cd /app/$BUILDING_SERVICE && pnpm build && if [ "$BUILD_BUNDLE" = "1" ] && grep -q '"build:bundle"' package.json 2>/dev/null; then pnpm run build:bundle; fi && cd /app ; \
    elif echo "$BUILDING_SERVICE" | grep -q '^packages/' ; then npx turbo run build --filter=@conduitplatform/core --filter=@conduitplatform/hermes --filter=@conduitplatform/node-2fa && cd /app/$BUILDING_SERVICE && if [ "$BUILD_BUNDLE" = "1" ] && grep -q '"build:bundle"' package.json 2>/dev/null; then pnpm run build:bundle; fi && cd /app ; \
    else cd /app/$BUILDING_SERVICE && pnpm build && cd /app ; fi

RUN pnpm store prune && pnpm -r exec rm -rf node_modules && rm -rf node_modules
