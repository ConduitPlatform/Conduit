FROM conduit-builder

WORKDIR /app/modules/communications

COPY --from=conduit-base /app/modules/communications/bundle /app/modules/communications/bundle
COPY --from=conduit-base /app/modules/communications/package.bundle.json /app/modules/communications/package.json
COPY --from=conduit-base /app/modules/communications/package.bundle-lock.json /app/modules/communications/package-lock.json

RUN apk update && \
    apk add --no-cache --virtual .gyp python3 make g++ && \
    npm ci --omit=dev --ignore-scripts && \
    npm rebuild bcrypt && \
    npm cache clean --force && \
    apk del .gyp

ENV NODE_ENV=production
ENV CONDUIT_SERVER=conduit_server
ENV SERVICE_URL=0.0.0.0:5000
ENV GRPC_PORT=5000

EXPOSE 5000

CMD ["node", "bundle/index.js"]
