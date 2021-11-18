FROM node:fermium

ARG BUILDING_SERVICE

COPY . /app

WORKDIR /app

RUN apt update && \
    curl -OL https://github.com/google/protobuf/releases/download/v3.17.3/protoc-3.17.3-linux-x86_64.zip && \
    unzip -o ./protoc-3.17.3-linux-x86_64.zip -d /usr/local bin/protoc && \
    unzip -o ./protoc-3.17.3-linux-x86_64.zip -d /usr/local include/* && \
    rm -f protoc-3.17.3-linux-x86_64.zip

RUN npm install -g node-gyp ts-proto

RUN yarn && \
    npx lerna run build --scope=@quintessential-sft/conduit-grpc-sdk

RUN if [  -z "$BUILDING_SERVICE" ] ; then npx lerna run build ;  \
    elif [ "$BUILDING_SERVICE" = "admin" ] ; then npx lerna run build --scope=@quintessential-sft/admin-front; \
    elif [ "$BUILDING_SERVICE" = "conduit" ] ; then npx lerna run build --scope=@quintessential-sft/conduit-admin \
    --scope=@quintessential-sft/conduit-commons --scope=@quintessential-sft/conduit-config \
    --scope=@quintessential-sft/core --scope=@quintessential-sft/conduit-router --scope=@quintessential-sft/conduit-security ; \
    else cd /app/$BUILDING_SERVICE && yarn build && cd /app ; fi

RUN npx lerna clean -y && rm -rf node_modules
