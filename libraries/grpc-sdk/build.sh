#!/usr/bin/bash
cd ../protos
sh build.sh
cd ../grpc-sdk
rm -rf ./src/proto
mkdir ./src/proto
cp -r ../protos/src/*.proto ./src/proto
