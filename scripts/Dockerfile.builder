FROM node:24-alpine3.22

WORKDIR /app

RUN npm install -g pnpm@11.5.0

ENV PNPM_CONFIG_TRUST_LOCKFILE=true
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
ENV PNPM_CONFIG_UPDATE_NOTIFIER=false

COPY --from=conduit-base /app/libraries/grpc-sdk /app/libraries/grpc-sdk
COPY --from=conduit-base /app/libraries/module-tools /app/libraries/module-tools
COPY --from=conduit-base /app/package.json .
COPY --from=conduit-base /app/pnpm-lock.yaml .
COPY --from=conduit-base /app/pnpm-workspace.yaml .

#RUN apk add --no-cache --virtual .gyp python2 make g++
