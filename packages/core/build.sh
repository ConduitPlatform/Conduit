rm -rf ../commons/src/protoTypes
mkdir ../commons/src/protoTypes

echo "Generating typescript code"
protoc --plugin=./node_modules/.bin/protoc-gen-ts_proto\
  --ts_proto_out=../commons/src/protoTypes\
  --ts_proto_opt=onlyTypes=true\
  ./src/core.proto

echo "Cleaning up folders"
cp ../commons/src/protoTypes/src/*.ts ../commons/src/protoTypes/
rm -rf ../commons/src/protoTypes/src/