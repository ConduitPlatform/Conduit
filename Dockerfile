FROM node:fermium

#RUN apk --no-cache add --virtual builds-deps build-base python

COPY . /app

WORKDIR /app

#RUN npm install -g yarn
RUN apt update
RUN curl -OL https://github.com/google/protobuf/releases/download/v3.17.3/protoc-3.17.3-linux-x86_64.zip
RUN ls -la
RUN unzip -o ./protoc-3.17.3-linux-x86_64.zip -d /usr/local bin/protoc
RUN unzip -o ./protoc-3.17.3-linux-x86_64.zip -d /usr/local include/*
RUN rm -f protoc-3.17.3-linux-x86_64.zip

RUN npm install -g node-gyp
RUN npm install -g ts-proto
RUN yarn && npx lerna run build
