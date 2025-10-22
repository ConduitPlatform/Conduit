rm -rf ./src/protoUtils
mkdir ./src/protoUtils

echo "Copying proto files from module folders"
copyfiles ../../**/src/*.proto -e ../../**/node_modules/**/*.proto -e ../../**/protos/src/**/*.proto -e ../../**/grpc_health_check.proto -f ./src/protoUtils
copyfiles ./src/grpc_health_check.proto -f ./src/protoUtils
copyfiles ./src/module.proto -f ./src/protoUtils

echo "Generating typescript code"
cd ./src/protoUtils || exit
protoc \
  --plugin=protoc-gen-ts_proto=../../node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=outputServices=generic-definitions,exportCommonSymbols=false,useExactTypes=false \
  --ts_proto_out=./ \
  --ts_proto_opt=importSuffix=.js \
  --ts_proto_opt=snakeToCamel=false \
  ./*.proto

echo "Post-processing generated files"
# Export MessageFns interface in empty.ts to fix TS4023 errors
if [ -f "./google/protobuf/empty.ts" ]; then
  sed -i.bak 's/^interface MessageFns<T>/export interface MessageFns<T>/' "./google/protobuf/empty.ts"
  rm "./google/protobuf/empty.ts.bak"
fi

# Initialize the content of the index.ts file
INDEX_CONTENT=""

# Loop through all .ts files in the folder, excluding index.ts and generateIndexFile.sh
for FILE in ./*.ts; do
  FILENAME=$(basename -- "$FILE")
  if [ "$FILENAME" != "index.ts" ]; then
    # Remove the file extension and create an export statement
    BASENAME="${FILENAME%.ts}"
    EXPORT_STATEMENT="export * from './$BASENAME.js';"

    # Append the export statement to the index.ts content
    INDEX_CONTENT="$INDEX_CONTENT$EXPORT_STATEMENT\n"
  fi
done
# Write the content to the index.ts file
echo "$INDEX_CONTENT" > "./index.ts"
echo "Successfully generated index.ts file"

echo "Cleaning up protofiles"
rm -rf ./*.proto
