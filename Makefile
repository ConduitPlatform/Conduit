GIT_SHA1 = $(shell git rev-parse --verify HEAD)
IMAGE_TAG = ${shell git describe --tags `git rev-list --tags --max-count=1` 2> /dev/null || echo 'latest' }

IMAGE_DIRS = $(wildcard libraries/* modules/*)

all: conduit admin ${IMAGE_DIRS}

conduit:
ifeq ($(DEV),TRUE)
	docker build -t quintessential.azurecr.io/conduit:latest ./packages
	docker push quintessential.azurecr.io/conduit:latest
else
	docker build -t quintessential.azurecr.io/conduit:${IMAGE_TAG} ./packages
	docker push quintessential.azurecr.io/conduit:${IMAGE_TAG}
endif

admin:
ifeq ($(DEV),TRUE)
	docker build -t quintessential.azurecr.io/conduit-admin:latest ./admin/app
	docker push quintessential.azurecr.io/conduit-admin:latest
else
	docker build -t quintessential.azurecr.io/conduit-admin:${IMAGE_TAG} ./admin/app
	docker push quintessential.azurecr.io/conduit-admin:${IMAGE_TAG}
endif

conduit-builder:
	docker build -t conduit-base:latest -f ./Dockerfile ./
	docker build -t conduit-builder:latest -f ./scripts/Dockerfile.builder ./scripts

${IMAGE_DIRS}:
	$(eval IMAGE_NAME := $(word 2,$(subst /, ,$@)))
ifeq ($(DEV),TRUE)
	docker build -t quintessential.azurecr.io/conduit-${IMAGE_NAME}:latest $@
	docker push quintessential.azurecr.io/conduit-${IMAGE_NAME}:latest
else
	docker build -t quintessential.azurecr.io/conduit-${IMAGE_NAME}:${IMAGE_TAG} $@
	docker push quintessential.azurecr.io/conduit-${IMAGE_NAME}:${IMAGE_TAG}
endif

#modules/authentication: conduit-builder
#modules/cms: conduit-builder
#modules/database: conduit-builder
#modules/email: conduit-builder
#modules/chat: conduit-builder
#modules/actor: conduit-builder
#modules/forms: conduit-builder
#modules/payments: conduit-builder
#modules/sms: conduit-builder
#modules/storage: conduit-builder
conduit: conduit-builder
admin: conduit-builder
