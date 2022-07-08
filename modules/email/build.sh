rm -rf ./src/protoTypes
mkdir ./src/protoTypes


cp ./src/*.proto ./src/protoTypes

cd ./src/protoTypes || exit

echo "Generating typescript code"
protoc \
  --plugin=../../node_modules/.bin/protoc-gen-ts_proto\
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_out=./ \
  --ts_proto_opt=outputServices=generic-definitions,useExactTypes=false\
  ./*.proto

echo "Cleaning up folders"
rm -rf ./*.proto
