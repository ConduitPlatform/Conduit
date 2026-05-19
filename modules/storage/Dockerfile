FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/modules/storage /app/modules/storage

RUN pnpm install --prod --frozen-lockfile --ignore-scripts && pnpm store prune

WORKDIR /app/modules/storage

ENV NODE_ENV production

ENV CONDUIT_SERVER conduit_server

ENV SERVICE_URL 0.0.0.0:5000

ENV GRPC_PORT 5000

EXPOSE 5000

CMD ["node", "dist/index.js"]
