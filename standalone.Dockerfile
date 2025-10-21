FROM node:jod-alpine

WORKDIR /app

COPY --from=conduit-base:latest /app/ /app/

RUN apk update && \
    apk add --no-cache --virtual .gyp python3 make g++ && \
    yarn global add pm2 && \
    yarn install --production --pure-lockfile --non-interactive && \
    yarn cache clean && \
    apk del .gyp


CMD ["pm2-runtime", "./standalone/ecosystem.config.js"]
