FROM conduit-builder

WORKDIR /app/modules/chat

COPY --from=conduit-base /app/modules/chat/bundle /app/modules/chat/bundle
COPY --from=conduit-base /app/modules/chat/package.bundle.json /app/modules/chat/package.json
COPY --from=conduit-base /app/modules/chat/package.bundle-lock.json /app/modules/chat/package-lock.json

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

ENV NODE_ENV=production
ENV CONDUIT_SERVER=conduit_server
ENV SERVICE_URL=0.0.0.0:5000
ENV GRPC_PORT=5000

EXPOSE 5000

CMD ["node", "bundle/index.js"]
