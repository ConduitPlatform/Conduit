FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/modules/email /app/modules/email
COPY --from=conduit-base:latest /app/providers/email-provider /app/providers/email-provider

RUN yarn install --production --pure-lockfile --non-interactive --cache-folder ./ycache; rm -rf ./ycache

WORKDIR /app/modules/email

ENV CONDUIT_SERVER conduit_server

ENV SERVICE_PORT 5000

ENV REGISTER_NAME true

EXPOSE 5000

CMD ["yarn", "start"]
