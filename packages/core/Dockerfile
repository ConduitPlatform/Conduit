FROM conduit-builder

WORKDIR /app/packages/core

COPY --from=conduit-base /app/packages/core/bundle /app/packages/core/bundle
COPY --from=conduit-base /app/packages/core/package.bundle.json /app/packages/core/package.json
COPY --from=conduit-base /app/packages/core/package.bundle-lock.json /app/packages/core/package-lock.json

RUN apk update && \
    apk add --no-cache --virtual .gyp python3 make g++ && \
    npm ci --omit=dev --ignore-scripts && \
    npm rebuild bcrypt && \
    npm cache clean --force && \
    apk del .gyp

# Hermes + grpc-sdk stay external (not inlined). Real copies nested under node_modules
# (not symlinks to /app/libraries) — Node ESM resolves via realpath, so symlinks break
# dep lookup from hermes/dist into core node_modules.
COPY --from=conduit-base /app/libraries/hermes/package.json \
  node_modules/@conduitplatform/hermes/package.json
COPY --from=conduit-base /app/libraries/hermes/dist \
  node_modules/@conduitplatform/hermes/dist
COPY --from=conduit-base /app/libraries/grpc-sdk/package.json \
  node_modules/@conduitplatform/grpc-sdk/package.json
COPY --from=conduit-base /app/libraries/grpc-sdk/dist \
  node_modules/@conduitplatform/grpc-sdk/dist
RUN mkdir -p node_modules/@conduitplatform/hermes/dist/public

ENV NODE_ENV=production

# gRPC port
EXPOSE 55152
# HTTP port
EXPOSE 3030
# Socket port
EXPOSE 3031

CMD ["node", "bundle/index.js"]
