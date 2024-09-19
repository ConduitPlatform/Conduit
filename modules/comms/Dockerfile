FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/modules/email /app/modules/email

RUN yarn install --production --pure-lockfile --non-interactive && yarn cache clean

WORKDIR /app/modules/email

ENV CONDUIT_SERVER conduit_server

ENV SERVICE_URL 0.0.0.0:5000

ENV GRPC_PORT 5000

EXPOSE 5000

CMD ["yarn", "start"]
