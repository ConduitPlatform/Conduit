FROM node:24-alpine

WORKDIR /app

RUN npm install -g pnpm@10.9.0

COPY --from=conduit-base:latest /app/libraries/grpc-sdk /app/libraries/grpc-sdk
COPY --from=conduit-base:latest /app/libraries/module-tools /app/libraries/module-tools
COPY --from=conduit-base:latest /app/package.json .
COPY --from=conduit-base:latest /app/pnpm-lock.yaml .
COPY --from=conduit-base:latest /app/pnpm-workspace.yaml .

#RUN apk add --no-cache --virtual .gyp python2 make g++
