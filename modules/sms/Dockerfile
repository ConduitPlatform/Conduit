FROM node:dubnium-alpine

WORKDIR /app

COPY --from=conduit-base:latest /app/libraries /app/libraries
COPY --from=conduit-base:latest /app/modules/sms /app/modules/sms
COPY --from=conduit-base:latest /app/package.json .
COPY --from=conduit-base:latest /app/yarn.lock .

RUN apk add --no-cache --virtual .gyp python make g++ 

RUN yarn install --production --pure-lockfile --non-interactive --cache-folder ./ycache; rm -rf ./ycache

RUN apk del .gyp

WORKDIR /app/modules/sms

ENV CONDUIT_SERVER conduit_server
 
ENV SERVICE_URL 0.0.0.0:5000

ENV REGISTER_NAME true

EXPOSE 5000

CMD ["yarn", "start"]
