rm -rf ./src/protoTypes
mkdir ./src/protoTypes

if ! ls ./src/*.proto >/dev/null 2>&1; then
  echo "No .proto files in src; skipping protoc code generation"
  exit 0
fi

cp ./src/*.proto ./src/protoTypes

cd ./src/protoTypes || exit

echo "Generating typescript code"
protoc \
  --plugin=protoc-gen-ts_proto=../../node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=outputServices=generic-definitions,useExactTypes=false \
  --ts_proto_out=./ \
  --ts_proto_opt=importSuffix=.js \
  --ts_proto_opt=snakeToCamel=false \
  ./*.proto

echo "Cleaning up folders"
rm -rf ./*.proto
