FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/modules/database /app/modules/database

RUN yarn install --production --pure-lockfile --non-interactive --cache-folder ./ycache; rm -rf ./ycache

RUN apk del .gyp

WORKDIR /app/modules/database-provider

ENV CONDUIT_SERVER conduit_server

ENV databaseURL ***REMOVED***

ENV SERVICE_URL 0.0.0.0:5000

ENV REGISTER_NAME true

EXPOSE 5000

CMD ["yarn", "start"]
