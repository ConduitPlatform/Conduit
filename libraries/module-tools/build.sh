rm -rf ./src/protoUtils
mkdir ./src/protoUtils

echo "Copying proto files from module folders"
copyfiles ./src/grpc_health_check.proto -f ./src/protoUtils

echo "Generating typescript code"
cd ./src/protoUtils || exit
protoc \
  --plugin=protoc-gen-ts_proto=../../node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=outputServices=generic-definitions,useExactTypes=false \
  --ts_proto_out=./ \
  ./*.proto

echo "Cleaning up protofiles"
rm -rf ./*.proto
