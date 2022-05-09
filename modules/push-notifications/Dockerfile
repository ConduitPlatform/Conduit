FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/modules/push-notifications /app/modules/push-notifications

RUN yarn install --production --pure-lockfile --non-interactive && yarn cache clean

WORKDIR /app/modules/push-notifications

ENV CONDUIT_SERVER conduit_server

ENV SERVICE_IP 0.0.0.0:5000

ENV REGISTER_NAME true

EXPOSE 5000

CMD ["yarn", "start"]
