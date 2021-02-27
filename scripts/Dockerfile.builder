FROM node:fermium-alpine

WORKDIR /app

COPY --from=conduit-base:latest /app/libraries /app/libraries
COPY --from=conduit-base:latest /app/package.json .
COPY --from=conduit-base:latest /app/yarn.lock .

RUN apk add --no-cache --virtual .gyp python make g++
