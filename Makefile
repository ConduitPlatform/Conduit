GIT_SHA1 = $(shell git rev-parse --verify HEAD)
IMAGE_TAG = ${shell git describe --tags `git rev-list --tags --max-count=1` 2> /dev/null || echo 'latest' }

IMAGE_DIRS = $(wildcard libraries/* modules/*)

all: conduit ${IMAGE_DIRS}

conduit:
ifeq ($(DEV),TRUE)
	docker build --no-cache -t ghcr.io/conduitplatform/conduit:latest ./packages
	docker push ghcr.io/conduitplatform/conduit:latest
else
	docker build --no-cache -t ghcr.io/conduitplatform/conduit:${IMAGE_TAG} ./packages
	docker push ghcr.io/conduitplatform/conduit:${IMAGE_TAG}
endif

conduit-builder:
ifeq ($(MAKECMDGOALS), all)
	docker build --no-cache -t conduit-base:latest -f ./Dockerfile ./
	docker build --no-cache -t conduit-builder:latest -f ./scripts/Dockerfile.builder ./scripts
else
	docker build --no-cache -t conduit-base:latest --build-arg BUILDING_SERVICE=$(MAKECMDGOALS) -f ./Dockerfile ./
	docker build --no-cache -t conduit-builder:latest -f ./scripts/Dockerfile.builder ./scripts
endif

${IMAGE_DIRS}:
	$(eval IMAGE_NAME := $(word 2,$(subst /, ,$@)))
ifeq ($(DEV),TRUE)
	docker build --no-cache -t ghcr.io/conduitplatform/${IMAGE_NAME}:latest $@
	docker push ghcr.io/conduitplatform/${IMAGE_NAME}:latest
else
	docker build --no-cache -t ghcr.io/conduitplatform/${IMAGE_NAME}:${IMAGE_TAG} $@
	docker push ghcr.io/conduitplatform/${IMAGE_NAME}:${IMAGE_TAG}
endif

modules/authentication: conduit-builder
modules/database: conduit-builder
modules/email: conduit-builder
modules/chat: conduit-builder
modules/forms: conduit-builder
modules/sms: conduit-builder
modules/storage: conduit-builder
modules/push-notifications: conduit-builder
conduit: conduit-builder
