FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/modules/storage /app/modules/storage

RUN yarn install --production --pure-lockfile --non-interactive && yarn cache clean

WORKDIR /app/modules/storage

ENV CONDUIT_SERVER conduit_server

ENV SERVICE_IP 0.0.0.0:5000

ENV REGISTER_NAME true

EXPOSE 5000

CMD ["yarn", "start"]
