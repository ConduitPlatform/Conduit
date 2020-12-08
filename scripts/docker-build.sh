docker build -t conduit-base:latest -f ./Dockerfile ./;
docker build -t quintessential.azurecr.io/conduit:latest -f ./packages/Dockerfile ./ && docker push quintessential.azurecr.io/conduit:latest;
npx lerna run build:docker