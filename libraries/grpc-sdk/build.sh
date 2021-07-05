#!/usr/bin/bash
cd ../protos
sh build.sh
cd ../grpc-sdk
rm -rf ./src/proto
mkdir ./src/proto
cp -r ../protos/src/*.proto ./src/proto
rm -rf ./src/protoUtils
mkdir ./src/protoUtils

protoc --plugin=./node_modules/.bin/protoc-gen-ts_proto \
--ts_proto_opt=outputServices=grpc-js \
--ts_proto_opt=env=node \
--ts_proto_opt=useOptionals=true \
--ts_proto_opt=esModuleInterop=true \
--ts_proto_out=./src/protoUtils ./src/proto/*.proto

rm -rf ./src/proto
cp -r ./src/protoUtils/src/proto/ ./src/protoUtils
rm -rf ./src/protoUtils/src/proto/
rm -rf ./src/protoUtils/src
