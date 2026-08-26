FROM node:24-alpine3.22

WORKDIR /app

# Hermes + grpc-sdk dist for nested COPY into core/router node_modules (never symlink /app/libraries).
COPY --from=conduit-base /app/libraries/hermes/package.json /app/libraries/hermes/package.json
COPY --from=conduit-base /app/libraries/hermes/dist /app/libraries/hermes/dist
COPY --from=conduit-base /app/libraries/grpc-sdk/package.json /app/libraries/grpc-sdk/package.json
COPY --from=conduit-base /app/libraries/grpc-sdk/dist /app/libraries/grpc-sdk/dist

COPY standalone/install-bundle-service.sh /app/standalone/install-bundle-service.sh
COPY standalone/ecosystem.config.js /app/standalone/ecosystem.config.js

# Core
COPY --from=conduit-base /app/packages/core/bundle /app/packages/core/bundle
COPY --from=conduit-base /app/packages/core/package.bundle.json /app/packages/core/package.json
COPY --from=conduit-base /app/packages/core/package.bundle-lock.json /app/packages/core/package-lock.json

# Modules (standalone PM2 set — functions excluded)
COPY --from=conduit-base /app/modules/database/bundle /app/modules/database/bundle
COPY --from=conduit-base /app/modules/database/package.bundle.json /app/modules/database/package.json
COPY --from=conduit-base /app/modules/database/package.bundle-lock.json /app/modules/database/package-lock.json

COPY --from=conduit-base /app/modules/router/bundle /app/modules/router/bundle
COPY --from=conduit-base /app/modules/router/package.bundle.json /app/modules/router/package.json
COPY --from=conduit-base /app/modules/router/package.bundle-lock.json /app/modules/router/package-lock.json

COPY --from=conduit-base /app/modules/authentication/bundle /app/modules/authentication/bundle
COPY --from=conduit-base /app/modules/authentication/package.bundle.json /app/modules/authentication/package.json
COPY --from=conduit-base /app/modules/authentication/package.bundle-lock.json /app/modules/authentication/package-lock.json

COPY --from=conduit-base /app/modules/authorization/bundle /app/modules/authorization/bundle
COPY --from=conduit-base /app/modules/authorization/package.bundle.json /app/modules/authorization/package.json
COPY --from=conduit-base /app/modules/authorization/package.bundle-lock.json /app/modules/authorization/package-lock.json

COPY --from=conduit-base /app/modules/communications/bundle /app/modules/communications/bundle
COPY --from=conduit-base /app/modules/communications/package.bundle.json /app/modules/communications/package.json
COPY --from=conduit-base /app/modules/communications/package.bundle-lock.json /app/modules/communications/package-lock.json

COPY --from=conduit-base /app/modules/storage/bundle /app/modules/storage/bundle
COPY --from=conduit-base /app/modules/storage/package.bundle.json /app/modules/storage/package.json
COPY --from=conduit-base /app/modules/storage/package.bundle-lock.json /app/modules/storage/package-lock.json

COPY --from=conduit-base /app/modules/chat/bundle /app/modules/chat/bundle
COPY --from=conduit-base /app/modules/chat/package.bundle.json /app/modules/chat/package.json
COPY --from=conduit-base /app/modules/chat/package.bundle-lock.json /app/modules/chat/package-lock.json

RUN chmod +x /app/standalone/install-bundle-service.sh && \
    apk update && \
    apk add --no-cache --virtual .gyp python3 py3-setuptools make g++ && \
    npm install -g pm2 && \
    for dir in packages/core modules/database modules/router modules/authentication modules/authorization modules/communications modules/storage modules/chat; do \
      sh /app/standalone/install-bundle-service.sh "$dir" /app/libraries; \
    done && \
    npm cache clean --force && \
    apk del .gyp

ENV NODE_ENV=production

# gRPC (core)
EXPOSE 55152
# Admin HTTP / Socket
EXPOSE 3030
EXPOSE 3031
# Module gRPC ports (ecosystem.config.js)
EXPOSE 55160 55161 55162 55164 55168 55169 55170

CMD ["pm2-runtime", "./standalone/ecosystem.config.js"]
