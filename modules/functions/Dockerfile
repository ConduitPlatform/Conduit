FROM conduit-builder

WORKDIR /app/modules/functions

COPY --from=conduit-base /app/modules/functions/bundle /app/modules/functions/bundle
COPY --from=conduit-base /app/modules/functions/package.bundle.json /app/modules/functions/package.json
COPY --from=conduit-base /app/modules/functions/package.bundle-lock.json /app/modules/functions/package-lock.json

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

ENV NODE_ENV=production
ENV CONDUIT_SERVER=conduit_server
ENV SERVICE_URL=0.0.0.0:5000
ENV GRPC_PORT=5000

EXPOSE 5000

CMD ["node", "bundle/index.js"]
