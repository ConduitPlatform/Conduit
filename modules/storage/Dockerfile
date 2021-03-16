FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/modules/storage /app/modules/storage
COPY --from=conduit-base:latest /app/providers/storage-provider /app/providers/storage-provider

RUN yarn install --production --pure-lockfile --non-interactive --cache-folder ./ycache; rm -rf ./ycache

WORKDIR /app/modules/storage

ENV CONDUIT_SERVER conduit_server

ENV SERVICE_URL 0.0.0.0:5000

ENV REGISTER_NAME true

EXPOSE 5000

CMD ["yarn", "start"]
