FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/modules/authorization /app/modules/authorization

RUN apk update && \
    apk add --no-cache --virtual .gyp python3 make g++ && \
    yarn install --production --pure-lockfile --non-interactive && \
    yarn cache clean && \
    apk del .gyp

WORKDIR /app/modules/authorization

ENV NODE_ENV production

ENV CONDUIT_SERVER conduit_server

ENV SERVICE_IP 0.0.0.0:5000

ENV REGISTER_NAME true

EXPOSE 5000

CMD ["node", "dist/index.js"]
