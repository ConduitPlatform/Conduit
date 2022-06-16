FROM node:gallium

ARG BUILDING_SERVICE

COPY . /app

WORKDIR /app

RUN curl -OL https://github.com/google/protobuf/releases/download/v3.17.3/protoc-3.17.3-linux-x86_64.zip && \
    unzip -o ./protoc-3.17.3-linux-x86_64.zip -d /usr/local bin/protoc && \
    unzip -o ./protoc-3.17.3-linux-x86_64.zip -d /usr/local include/* && \
    rm -f protoc-3.17.3-linux-x86_64.zip

RUN npm install -g node-gyp ts-proto

RUN yarn && \
    npx lerna run build --scope=@conduitplatform/grpc-sdk

RUN if [  -z "$BUILDING_SERVICE" ] ; then npx lerna run build ;  \
    elif [ "$BUILDING_SERVICE" = "conduit" ] ; then npx lerna run build --scope=@conduitplatform/admin \
    --scope=@conduitplatform/commons --scope=@conduitplatform/core --scope=@conduitplatform/hermes; \
    elif [ "$BUILDING_SERVICE" = "modules/router" ] ; then npx lerna run build --scope=@conduitplatform/router \
    --scope=@conduitplatform/hermes; \
    else cd /app/$BUILDING_SERVICE && yarn build && cd /app ; fi

RUN yarn cache clean && npx lerna clean -y && rm -rf node_modules
