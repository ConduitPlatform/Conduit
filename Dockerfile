FROM node:dubnium-alpine

RUN apk --no-cache add --virtual builds-deps build-base python

COPY . /app

WORKDIR /app

RUN npm install && npx lerna bootstrap

WORKDIR /app/packages/core

CMD ["npm", "start"]
