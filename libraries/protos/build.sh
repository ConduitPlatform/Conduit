rimraf ./src
mkdir ./src
echo '' > ./src/.gitkeep
copyfiles ../../**/src/*.proto -e ../../**/node_modules/**/*.proto -e ../../**/protos/src/**/*.proto -f ./src
git add ./src
