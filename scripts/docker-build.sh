time docker build -t conduit-base:latest -f ./Dockerfile ./;
time docker build -t conduit-builder:latest -f ./scripts/Dockerfile.builder ./scripts;
time docker build -t quintessential.azurecr.io/conduit:latest -f ./packages/Dockerfile ./ && docker push quintessential.azurecr.io/conduit:latest;
time npx lerna run build:docker