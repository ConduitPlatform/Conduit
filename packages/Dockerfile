FROM conduit-builder:latest

WORKDIR /app

COPY --from=conduit-base:latest /app/packages /app/packages

RUN yarn install --production --pure-lockfile --non-interactive --cache-folder ./ycache; rm -rf ./ycache

#RUN apk del .gyp

WORKDIR /app/packages/core

# gRPC port
EXPOSE 55152
# HTTP port
EXPOSE 3000
# Socket port
EXPOSE 3001

CMD ["yarn", "start"]
