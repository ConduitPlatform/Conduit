FROM node:dubnium-alpine

WORKDIR /app

COPY --from=conduit-base:latest /app/libraries /app/libraries
COPY --from=conduit-base:latest /app/packages /app/packages
COPY --from=conduit-base:latest /app/package.json .
COPY --from=conduit-base:latest /app/yarn.lock .

RUN apk add --no-cache --virtual .gyp python make g++ 

RUN yarn install --production --pure-lockfile --non-interactive --cache-folder ./ycache; rm -rf ./ycache

RUN apk del .gyp

WORKDIR /app/packages/core

EXPOSE 55152

EXPOSE 3000

CMD ["yarn", "start"]
