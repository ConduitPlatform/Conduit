FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/packages /app/packages

RUN yarn install --production --pure-lockfile --non-interactive --cache-folder ./ycache; rm -rf ./ycache

RUN apk del .gyp

WORKDIR /app/packages/core

EXPOSE 55152

EXPOSE 3000

CMD ["yarn", "start"]
