FROM node:20.18.2-alpine3.20

WORKDIR /app

COPY --from=conduit-base:latest /app/libraries/grpc-sdk /app/libraries/grpc-sdk
COPY --from=conduit-base:latest /app/libraries/module-tools /app/libraries/module-tools
COPY --from=conduit-base:latest /app/package.json .
COPY --from=conduit-base:latest /app/yarn.lock .

#RUN apk add --no-cache --virtual .gyp python2 make g++
