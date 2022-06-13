FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/modules/authentication /app/modules/authentication

RUN apk update && \
    apk add --no-cache --virtual .gyp python3 make g++ && \
    yarn install --production --pure-lockfile --non-interactive && \
    yarn cache clean && \
    apk del .gyp

WORKDIR /app/modules/authentication

ENV CONDUIT_SERVER conduit_server

ENV SERVICE_IP 0.0.0.0:5000

ENV REGISTER_NAME true

EXPOSE 5000

CMD ["yarn", "start"]
