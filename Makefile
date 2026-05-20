GIT_SHA1 = $(shell git rev-parse --verify HEAD)
IMAGE_TAG ?= $(shell git describe --tags `git rev-list --tags --max-count=1` 2> /dev/null || echo 'latest' )

ifeq ($(NEXT),TRUE)
	TAG_SUFFIX = :next
else ifeq ($(DEV),TRUE)
	TAG_SUFFIX = :dev
else
	TAG_SUFFIX = :$(IMAGE_TAG)
endif

MODULE_DOCKERFILES = $(wildcard modules/*/Dockerfile)
IMAGE_DIRS = $(patsubst %/Dockerfile,%,$(MODULE_DOCKERFILES))

all: conduit $(IMAGE_DIRS)

define build_docker_image
	docker build --no-cache -t ghcr.io/conduitplatform/$(1)$(TAG_SUFFIX) $(3)
	docker push ghcr.io/conduitplatform/$(1)$(TAG_SUFFIX)
	$(eval SKIP_LATEST=$(if $(or $(findstring alpha,$(2)),$(findstring beta,$(2)),$(findstring rc,$(2))),true,false))
	@if [ "$(SKIP_LATEST)" = "false" ] && [ "$(TAG_SUFFIX)" != ":dev" ] && [ "$(TAG_SUFFIX)" != ":next" ]; then \
		docker tag ghcr.io/conduitplatform/$(1)$(TAG_SUFFIX) conduitplatform/$(1):$(2) ; \
		docker tag ghcr.io/conduitplatform/$(1)$(TAG_SUFFIX) ghcr.io/conduitplatform/$(1):latest ; \
		docker tag ghcr.io/conduitplatform/$(1)$(TAG_SUFFIX) conduitplatform/$(1):latest ; \
		docker push conduitplatform/$(1):$(2) ; \
		docker push ghcr.io/conduitplatform/$(1):latest ; \
		docker push conduitplatform/$(1):latest ; \
	else \
		echo "Skipping latest tag due to alpha, beta, or rc in IMAGE_TAG or DEV=TRUE or NEXT=TRUE" ; \
	fi
endef

conduit-builder: Dockerfile scripts/Dockerfile.builder
	@if [ "$(filter-out $@,$(MAKECMDGOALS))" = "all" ]; then \
    		docker build --no-cache -t conduit-base:latest -f ./Dockerfile ./ ; \
    	else \
    		docker build --no-cache -t conduit-base:latest --build-arg BUILDING_SERVICE=$(filter-out $@,$(MAKECMDGOALS)) -f ./Dockerfile ./ ; \
    	fi
	docker build --no-cache -t conduit-builder:latest -f ./scripts/Dockerfile.builder ./scripts

conduit: conduit-builder
	$(call build_docker_image,conduit,$(IMAGE_TAG),./packages/core)

$(IMAGE_DIRS): conduit-builder
	$(eval IMAGE_NAME := $(word 2,$(subst /, ,$@)))
	$(call build_docker_image,$(IMAGE_NAME),$(IMAGE_TAG),$@)

.PHONY: all conduit-builder conduit $(IMAGE_DIRS)
