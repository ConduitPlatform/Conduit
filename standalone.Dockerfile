FROM node:24-alpine

WORKDIR /app

COPY --from=conduit-base:latest /app/ /app/

RUN apk update && \
    apk add --no-cache --virtual .gyp python3 py3-setuptools make g++ && \
    npm install -g pm2 pnpm@10.9.0 && \
    pnpm install --prod --frozen-lockfile --ignore-scripts && \
    pnpm store prune && \
    apk del .gyp


CMD ["pm2-runtime", "./standalone/ecosystem.config.js"]
