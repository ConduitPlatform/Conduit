FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/packages /app/packages
COPY --from=conduit-base:latest /app/libraries/hermes /app/libraries/hermes

RUN yarn install --production --pure-lockfile --non-interactive && yarn cache clean

#RUN apk del .gyp

WORKDIR /app/packages/core

# gRPC port
EXPOSE 55152
# HTTP port
EXPOSE 3030
# Socket port
EXPOSE 3031

CMD ["yarn", "start"]
