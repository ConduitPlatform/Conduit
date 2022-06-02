FROM node:gallium-alpine

WORKDIR /app

COPY --from=conduit-base:latest /app/libraries/grpc-sdk /app/libraries/grpc-sdk
COPY --from=conduit-base:latest /app/package.json .
COPY --from=conduit-base:latest /app/yarn.lock .

#RUN apk add --no-cache --virtual .gyp python2 make g++
