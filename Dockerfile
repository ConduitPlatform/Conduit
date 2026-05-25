FROM node:24

ARG BUILDING_SERVICE

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

RUN npm install -g node-gyp ts-proto pnpm@10.9.0

RUN pnpm install --frozen-lockfile --ignore-scripts && \
    pnpm rebuild @apollo/protobufjs @firebase/util bcrypt esbuild keccak msgpackr-extract protobufjs secp256k1 sqlite3 unrs-resolver vue-demi && \
    npx turbo run build --filter=@conduitplatform/grpc-sdk --filter=@conduitplatform/module-tools

RUN if [  -z "$BUILDING_SERVICE" ] ; then npx turbo run build ;  \
    elif [ "$BUILDING_SERVICE" = "conduit" ] ; then npx turbo run build --filter=@conduitplatform/core --filter=@conduitplatform/hermes \
    --filter=@conduitplatform/node-2fa; \
    elif [ "$BUILDING_SERVICE" = "modules/router" ] ; then npx turbo run build --filter=@conduitplatform/router \
    --filter=@conduitplatform/hermes; \
    elif [ "$BUILDING_SERVICE" = "modules/authentication" ] ; then npx turbo run build --filter=@conduitplatform/authentication \
    --filter=@conduitplatform/node-2fa; \
    else cd /app/$BUILDING_SERVICE && pnpm build && cd /app ; fi

RUN pnpm store prune && pnpm -r exec rm -rf node_modules && rm -rf node_modules
