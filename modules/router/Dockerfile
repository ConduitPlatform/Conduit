FROM conduit-builder

WORKDIR /app/modules/router

COPY --from=conduit-base /app/modules/router/bundle /app/modules/router/bundle
COPY --from=conduit-base /app/modules/router/package.bundle.json /app/modules/router/package.json
COPY --from=conduit-base /app/modules/router/package.bundle-lock.json /app/modules/router/package-lock.json

RUN apk update && \
    apk add --no-cache --virtual .gyp python3 make g++ && \
    npm ci --omit=dev --ignore-scripts && \
    npm rebuild bcrypt && \
    npm cache clean --force && \
    apk del .gyp

# Hermes + grpc-sdk stay external (not inlined). Real copies nested under node_modules
# (not symlinks to /app/libraries) — Node ESM resolves via realpath, so symlinks break
# dep lookup from hermes/dist into router node_modules.
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
ENV CONDUIT_SERVER=conduit_server
ENV SERVICE_URL=0.0.0.0:5000
ENV GRPC_PORT=5000

EXPOSE 5000
EXPOSE 3000
EXPOSE 3001

CMD ["node", "bundle/index.js"]
