FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/admin/app /app/admin/app

RUN yarn install --production --pure-lockfile --non-interactive --cache-folder ./ycache; rm -rf ./ycache

RUN apk del .gyp

WORKDIR /app/admin/app

EXPOSE 8080

CMD ["yarn", "start"]