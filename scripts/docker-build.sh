time docker build -t conduit-base:latest -f ./Dockerfile ./;
time docker build -t conduit-builder:latest -f ./scripts/Dockerfile.builder ./scripts;
time docker build -t ghcr.io/conduitplatform/conduit:latest -f ./packages/Dockerfile ./ && docker push ghcr.io/conduitplatform/conduit:latest;
time npx lerna run build:docker
