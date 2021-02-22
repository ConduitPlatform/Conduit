GIT_SHA1 = $(shell git rev-parse --verify HEAD)
IMAGE_TAG = ${shell git describe --tags `git rev-list --tags --max-count=1` 2> /dev/null || echo 'latest' }

IMAGE_DIRS = $(wildcard libraries/* modules/*)

all: conduit ${IMAGE_DIRS}

conduit:
	docker build -t quintessential.azurecr.io/conduit:${IMAGE_TAG} ./packages
	docker push  quintessential.azurecr.io/conduit:${IMAGE_TAG}

conduit-builder:
	docker build -t conduit-base:latest -f ./Dockerfile ./
	docker build -t conduit-builder:latest -f ./scripts/Dockerfile.builder ./scripts

${IMAGE_DIRS}:
	$(eval IMAGE_NAME := $(word 2,$(subst /, ,$@)))
	docker build -t quintessential.azurecr.io/conduit-${IMAGE_NAME}:${IMAGE_TAG} $@
	docker push  quintessential.azurecr.io/conduit-${IMAGE_NAME}:${IMAGE_TAG}

modules/authentication: conduit-builder
modules/cms: conduit-builder
modules/database-provider: conduit-builder
modules/email: conduit-builder
modules/forms: conduit-builder
modules/payments: conduit-builder
modules/sms: conduit-builder
modules/storage: conduit-builder
