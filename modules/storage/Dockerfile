FROM conduit-builder

WORKDIR /app/modules/storage

COPY --from=conduit-base /app/modules/storage/bundle /app/modules/storage/bundle
COPY --from=conduit-base /app/modules/storage/package.bundle.json /app/modules/storage/package.json
COPY --from=conduit-base /app/modules/storage/package.bundle-lock.json /app/modules/storage/package-lock.json

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

ENV NODE_ENV=production
ENV CONDUIT_SERVER=conduit_server
ENV SERVICE_URL=0.0.0.0:5000
ENV GRPC_PORT=5000

EXPOSE 5000

CMD ["node", "bundle/index.js"]
