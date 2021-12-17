FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/modules/payments /app/modules/payments

RUN yarn install --production --pure-lockfile --non-interactive --cache-folder ./ycache; rm -rf ./ycache

WORKDIR /app/modules/payments

ENV CONDUIT_SERVER conduit_server

ENV SERVICE_IP 0.0.0.0:5000

ENV REGISTER_NAME true

EXPOSE 5000

CMD ["yarn", "start"]
