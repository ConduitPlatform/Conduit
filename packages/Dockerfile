FROM node:dubnium

WORKDIR /app

COPY --from=conduit-base:latest /app/libraries /app/libraries
COPY --from=conduit-base:latest /app/packages /app/packages
COPY --from=conduit-base:latest /app/node_modules /app/node_modules

WORKDIR /app/packages/core

EXPOSE 55152

EXPOSE 3000

CMD ["yarn", "start"]
