##
# Conduit Docker Compose
#
# @file
# @version 0.1

all: export _IMAGE_TAG = ${IMAGE_TAG}
all: export _MONGO_URL = ${MONGO_URL}

all: check-env
	@echo "----------------------CONDUIT---------------------------"
	@echo "Running Conduit docker-compose up with image tag: ${IMAGE_TAG}"
	docker-compose up --remove-orphans

check-env:
ifndef IMAGE_TAG
export IMAGE_TAG := latest
endif
ifndef MONGO_URL
	$(error MONGO_URL is undefined)
endif

destroy:
	docker-compose down

# end
