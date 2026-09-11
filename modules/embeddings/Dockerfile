# hadolint ignore=DL3006
FROM conduit-builder

WORKDIR /app/modules/embeddings

COPY --from=conduit-base /app/modules/embeddings/bundle /app/modules/embeddings/bundle
COPY --from=conduit-base /app/modules/embeddings/package.bundle.json /app/modules/embeddings/package.json
COPY --from=conduit-base /app/modules/embeddings/package.bundle-lock.json /app/modules/embeddings/package-lock.json

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

ENV NODE_ENV=production
ENV CONDUIT_SERVER=conduit_server
ENV SERVICE_URL=0.0.0.0:5000
ENV GRPC_PORT=5000

EXPOSE 5000

CMD ["node", "bundle/index.js"]
