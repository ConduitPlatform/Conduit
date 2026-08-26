FROM conduit-builder

WORKDIR /app/modules/database

COPY --from=conduit-base /app/modules/database/bundle /app/modules/database/bundle
COPY --from=conduit-base /app/modules/database/package.bundle.json /app/modules/database/package.json
COPY --from=conduit-base /app/modules/database/package.bundle-lock.json /app/modules/database/package-lock.json

RUN apk update && \
    apk add --no-cache --virtual .gyp python3 py3-setuptools make g++ && \
    npm ci --omit=dev --ignore-scripts && \
    npm rebuild sqlite3 && \
    npm cache clean --force && \
    apk del .gyp

ENV NODE_ENV=production
ENV CONDUIT_SERVER=conduit_server
ENV SERVICE_URL=0.0.0.0:5000
ENV GRPC_PORT=5000

EXPOSE 5000

CMD ["node", "bundle/index.js"]
