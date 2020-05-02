rimraf ./src
mkdir ./src
echo '' > ./src/.gitkeep
copyfiles ../../**/src/*.proto -e ../../**/node_modules/**/*.proto -e ../../**/protos/src/**/*.proto -f ./src
# todo add all src files to git
