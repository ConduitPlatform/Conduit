FROM conduit-builder

WORKDIR /app/modules/authentication

COPY --from=conduit-base /app/modules/authentication/bundle /app/modules/authentication/bundle
COPY --from=conduit-base /app/modules/authentication/package.bundle.json /app/modules/authentication/package.json
COPY --from=conduit-base /app/modules/authentication/package.bundle-lock.json /app/modules/authentication/package-lock.json

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
