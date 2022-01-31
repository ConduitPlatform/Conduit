.PHONY: setup start-conduit start-all stop-all clean mrproper build-conduit-base build-conduit-builder rmi-conduit-deps \
				build-core start-core stop-core rm-core rmi-core \
				build-authentication start-authentication stop-authentication rm-authentication rmi-authentication \
				build-cms start-cms stop-cms rm-cms rmi-cms \
				build-chat start-chat stop-chat rm-chat rmi-chat \
				build-database start-database stop-database rm-database rmi-database \
				build-email start-email stop-email rm-email rmi-email \
				build-forms start-forms stop-forms rm-forms rmi-forms \
				build-push-notifications start-push-notifications stop-push-notifications rm-push-notifications rmi-push-notifications \
				build-sms start-sms stop-sms rm-sms rmi-sms \
				build-storage start-storage stop-storage rm-storage rmi-storage \
				build-ui start-ui stop-ui rm-ui rmi-ui \
				start-redis stop-redis rm-redis rmi-redis \
				start-mongo stop-mongo rm-mongo rmi-mongo \
				start-postgres stop-postgres rm-postgres rmi-postgres

CWD    := $(abspath $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST))))))
UI_ARCHIVE_URL = "https://github.com/ConduitPlatform/Conduit-UI/archive/refs/tags/${TAG}.zip"

# ------ Default Values ------ #

TAG        ?= v0.10.6
DOCKER     ?= sudo docker
CONDUIT_EXT_BUILD_PATH ?= "/tmp/conduit"
CONTAINER_NETWORK_NAME ?= "conduit"
DB_TYPE    ?= "mongodb"
DB_URL     ?= "mongodb://conduit-mongo:27017"
CONDUIT_URL = "http://localhost:3000"

# ------ Common Targets ------ #

setup:
	@echo -e "\nInitializing Conduit Container Environment 🔨"
	@echo -e "This may take a while. Better bring up Reddit 😅"
	@echo -e "------------------------------------------------\n"
	@${DOCKER} network create ${CONTAINER_NETWORK_NAME} > /dev/null 2>&1 || true
	@$(MAKE) --no-print-directory build-conduit-base
	@$(MAKE) --no-print-directory build-conduit-builder
	@echo -e "\n"
	@$(MAKE) --no-print-directory build-ui
	@$(MAKE) --no-print-directory build-core
	@$(MAKE) --no-print-directory build-database
	@$(MAKE) --no-print-directory build-authentication
	@$(MAKE) --no-print-directory build-cms
	@echo -e "\n\nBuild Successful ✔️\n"

start-conduit:
	@$(MAKE) --no-print-directory start-core
	@$(MAKE) --no-print-directory start-database
	@$(MAKE) --no-print-directory start-authentication
	@$(MAKE) --no-print-directory start-cms
	@$(MAKE) --no-print-directory start-ui

start-all:
	@$(MAKE) --no-print-directory start-conduit
	@$(MAKE) --no-print-directory start-database
	@$(MAKE) --no-print-directory start-authentication
	@$(MAKE) --no-print-directory start-chat
	@$(MAKE) --no-print-directory start-cms
	@$(MAKE) --no-print-directory start-email
	@$(MAKE) --no-print-directory start-forms
	@$(MAKE) --no-print-directory start-push-notifications
	@$(MAKE) --no-print-directory start-sms
	@$(MAKE) --no-print-directory start-storage
	@$(MAKE) --no-print-directory start-ui

stop-all:
	-@$(MAKE) --no-print-directory stop-ui
	-@$(MAKE) --no-print-directory stop-authentication
	-@$(MAKE) --no-print-directory stop-chat
	-@$(MAKE) --no-print-directory stop-cms
	-@$(MAKE) --no-print-directory stop-email
	-@$(MAKE) --no-print-directory stop-forms
	-@$(MAKE) --no-print-directory stop-push-notifications
	-@$(MAKE) --no-print-directory stop-sms
	-@$(MAKE) --no-print-directory stop-storage
	-@$(MAKE) --no-print-directory stop-database
	-@$(MAKE) --no-print-directory stop-core
	-@$(MAKE) --no-print-directory stop-redis
	-@$(MAKE) --no-print-directory stop-mongo
	-@$(MAKE) --no-print-directory stop-postgres

clean:
	@echo -e "\n\nRemoving Containers 📦"
	@echo        "----------------------"
	@$(MAKE) --no-print-directory stop-all
	@$(MAKE) --no-print-directory rm-redis
	@$(MAKE) --no-print-directory rm-mongo
	@$(MAKE) --no-print-directory rm-postgres
	@$(MAKE) --no-print-directory rm-ui
	@$(MAKE) --no-print-directory rm-core
	@$(MAKE) --no-print-directory rm-authentication
	@$(MAKE) --no-print-directory rm-chat
	@$(MAKE) --no-print-directory rm-cms
	@$(MAKE) --no-print-directory rm-database
	@$(MAKE) --no-print-directory rm-email
	@$(MAKE) --no-print-directory rm-forms
	@$(MAKE) --no-print-directory rm-push-notifications
	@$(MAKE) --no-print-directory rm-sms
	@$(MAKE) --no-print-directory rm-storage
	@echo -e "\n\nRemoving Container Network 📡"
	@echo        "-----------------------------"
	@if ${DOCKER} network ls | grep ${CONTAINER_NETWORK_NAME} > /dev/null 2>&1; then \
		${DOCKER} network rm ${CONTAINER_NETWORK_NAME} > /dev/null 2>&1; \
		echo "Removed \"${CONTAINER_NETWORK_NAME}\" network."; \
	else \
		echo "Network already removed"; \
	fi

mrproper:
	@$(MAKE) --no-print-directory clean
	@echo -e "\n\nRemoving Container Images 💽"
	@echo         "----------------------------"
	@$(MAKE) --no-print-directory rmi-redis
	@$(MAKE) --no-print-directory rmi-mongo
	@$(MAKE) --no-print-directory rmi-postgres
	@$(MAKE) --no-print-directory rmi-ui
	@$(MAKE) --no-print-directory rmi-core
	@$(MAKE) --no-print-directory rmi-authentication
	@$(MAKE) --no-print-directory rmi-chat
	@$(MAKE) --no-print-directory rmi-cms
	@$(MAKE) --no-print-directory rmi-database
	@$(MAKE) --no-print-directory rmi-email
	@$(MAKE) --no-print-directory rmi-forms
	@$(MAKE) --no-print-directory rmi-push-notifications
	@$(MAKE) --no-print-directory rmi-sms
	@$(MAKE) --no-print-directory rmi-storage
	@$(MAKE) --no-print-directory rmi-conduit-deps

# ----- Docker Functions ----- #

# Params: Name, image-name, path/to/Dockerfile
define build_base
	@if ${DOCKER} image ls | grep ${2} > /dev/null 2>&1; then \
		echo -e "\n${1} image already exists"; \
	else \
		echo -e "\nBulding ${1} image"; \
		${DOCKER} build -t ${2} -f ${3} `dirname ${3}`; \
	fi
endef

# Params: Name, image-name, path/to/Dockerfile
define build
	@${DOCKER} image ls | grep conduit-base > /dev/null 2>&1 || make build-conduit-base
	@${DOCKER} image ls | grep conduit-builder > /dev/null 2>&1 || make build-conduit-builder
	$(call build_base,${1},${2},${3})
endef

# Params: Name, container-name, image-name, image-tag, docker args (optional)
define start
	@if ${DOCKER} container ls | grep ${2} > /dev/null 2>&1; then \
		echo -e "\n${1} container already running"; \
	elif ${DOCKER} container ls -a | grep ${2} > /dev/null 2>&1; then \
		echo -e "\nStarting ${1} container"; \
		${DOCKER} start ${2}; \
	else \
		${DOCKER} image ls | grep ${2} > /dev/null 2>&1 || \
			$(MAKE) --no-print-directory `echo ${2} | sed 's/^[^-]*-/build-/g'`; \
		echo -e "\nStarting ${1} container"; \
		${DOCKER} run --name ${2} --network-alias `echo ${2} | sed 's/^[^-]*-//g'` --network ${CONTAINER_NETWORK_NAME} -h ${2} ${5} ${3}:${4}; \
	fi
endef

# Params: Name, container-name
define stop
	@if ${DOCKER} container ls | grep ${2} > /dev/null 2>&1; then \
		echo -e "\nStopping ${1} container"; \
		${DOCKER} stop ${2}; \
	else \
		echo -e "\n${1} container not running"; \
	fi
endef

# Params: Name, container-name
define rm
	@if ${DOCKER} container ls -a | grep ${2} > /dev/null 2>&1; then \
		echo -e "\nRemoving ${1} container"; \
		${DOCKER} container rm ${2}; \
	else \
		echo -e "\n${1} does not have an available container"; \
	fi
endef

# Params: Name, image-name
define rmi
	@if ${DOCKER} image ls | grep ${2} > /dev/null 2>&1; then \
		echo -e "\nRemoving ${1} image"; \
		${DOCKER} image rm ${2}; \
	else \
		echo -e "\n${1} does not have an available image"; \
	fi
endef

# ------- Base Targets ------- #

build-core:
	$(call build,Conduit Core,conduit-core,${CWD}/../packages/Dockerfile)

build-authentication:
	$(call build,Authentication,conduit-authentication,${CWD}/../modules/authentication/Dockerfile)

build-chat:
	$(call build,Chat,conduit-chat,${CWD}/../modules/chat/Dockerfile)

build-cms:
	$(call build,CMS,conduit-cms,${CWD}/../modules/cms/Dockerfile)

build-database:
	@if [ ${DB_TYPE} == "mongodb" ]; then \
		make start-mongo; \
	elif [ ${DB_TYPE} == "sql" ]; then \
		make start-postgres; \
	else \
		echo -e "\nInvalid DB_TYPE override. Choose between 'mongodb' and 'sql' (default: mongodb)"; \
	fi
	$(call build,Database,conduit-database,${CWD}/../modules/database/Dockerfile)

build-email:
	$(call build,Email,conduit-email,${CWD}/../modules/email/Dockerfile)

build-forms:
	$(call build,Forms,conduit-forms,${CWD}/../modules/forms/Dockerfile)

build-push-notifications:
	$(call build,PushNotifications,conduit-push-notifications,${CWD}/../modules/push-notifications/Dockerfile)

build-sms:
	$(call build,SMS,conduit-sms,${CWD}/../modules/sms/Dockerfile)

build-storage:
	$(call build,Storage,conduit-storage,${CWD}/../modules/storage/Dockerfile)

build-ui:
	@mkdir -p ${CONDUIT_EXT_BUILD_PATH}
	@curl -L ${UI_ARCHIVE_URL} > ${CONDUIT_EXT_BUILD_PATH}/conduit-ui.zip
	@unzip -o ${CONDUIT_EXT_BUILD_PATH}/conduit-ui.zip -d ${CONDUIT_EXT_BUILD_PATH}
	@rm -rf ${CONDUIT_EXT_BUILD_PATH}/Conduit-UI
	@mv ${CONDUIT_EXT_BUILD_PATH}/Conduit-UI-`echo ${TAG} | sed -r 's/^.//'` ${CONDUIT_EXT_BUILD_PATH}/Conduit-UI
	$(call build_base,Conduit Admin Panel,conduit-ui,${CONDUIT_EXT_BUILD_PATH}/Conduit-UI/Dockerfile)
	@rm -rf ${CONDUIT_EXT_BUILD_PATH}

start-core:
	@$(MAKE) --no-print-directory start-redis
	$(call start,Core,conduit-core,conduit-core,latest, \
         -d -p 55152:55152 -p 3000:3000 -p 3001:3001 -e REDIS_HOST="conduit-redis" -e REDIS_PORT="6379")

start-authentication:
	$(call start,Authentication,conduit-authentication,conduit-authentication,latest, \
         -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-chat:
	$(call start,Chat,conduit-chat,conduit-chat,latest, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-cms:
	$(call start,CMS,conduit-cms,conduit-cms,latest, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-database:
	$(call start,Database,conduit-database,conduit-database,latest, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152" \
	       -e databaseType=${DB_TYPE} -e databaseURL=${DB_URL})

start-email:
	$(call start,Email,conduit-email,conduit-email,latest, \
         -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-forms:
	$(call start,Forms,conduit-forms,conduit-forms,latest, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-push-notifications:
	$(call start,PushNotifications,conduit-push-notifications,conduit-push-notifications,latest, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-sms:
	$(call start,SMS,conduit-sms,conduit-sms,latest, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-storage:
	$(call start,Storage,conduit-storage,conduit-storage,latest, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-ui:
	$(call start,Conduit Admin Panel,conduit-ui,conduit-ui,latest, \
	       -d -p 8080:8080 -e CONDUIT_URL=${CONDUIT_URL})

start-redis:
	$(call start,Redis,conduit-redis,redis,latest,-d -p 6379:6379)

start-mongo:
	$(call start,MongoDB,conduit-mongo,mongo,latest,-d -p 27017:27017)

start-postgres:
	$(call start,PostgreSQL,conduit-postgres,postgres,latest,-d -p 5432:5432)

stop-core:
	$(call stop,Conduit Core,conduit-core)

stop-authentication:
	$(call stop,Authentication,conduit-authentication)

stop-chat:
	$(call stop,Chat,conduit-chat)

stop-cms:
	$(call stop,CMS,conduit-cms)

stop-database:
	$(call stop,Database,conduit-database)

stop-email:
	$(call stop,Email,conduit-email)

stop-forms:
	$(call stop,Forms,conduit-forms)

stop-push-notifications:
	$(call stop,PushNotifications,conduit-push-notifications)

stop-sms:
	$(call stop,SMS,conduit-sms)

stop-storage:
	$(call stop,Storage,conduit-storage)

stop-ui:
	$(call stop,Conduit Admin Panel,conduit-ui)

stop-redis:
	$(call stop,Redis,conduit-redis)

stop-mongo:
	$(call stop,MongoDB,conduit-mongo)

stop-postgres:
	$(call stop,PostgreSQL,conduit-postgres)

rm-core:
	$(call rm,Conduit Core,conduit-core)

rm-authentication:
	$(call rm,Authentication,conduit-authentication)

rm-chat:
	$(call rm,Chat,conduit-chat)

rm-cms:
	$(call rm,CMS,conduit-cms)

rm-database:
	$(call rm,Database,conduit-database)

rm-email:
	$(call rm,Email,conduit-email)

rm-forms:
	$(call rm,Forms,conduit-forms)

rm-push-notifications:
	$(call rm,PushNotifications,conduit-push-notifications)

rm-sms:
	$(call rm,SMS,conduit-sms)

rm-storage:
	$(call rm,Storage,conduit-storage)

rm-ui:
	$(call rm,Core Admin Panel,conduit-ui)

rm-redis:
	$(call rm,Redis,conduit-redis)

rm-mongo:
	$(call rm,MongoDB,conduit-mongo)

rm-postgres:
	$(call rm,PostgreSQL,conduit-postgres)

rmi-core:
	$(call rmi,Conduit Core,conduit-core)

rmi-authentication:
	$(call rmi,Authentication,conduit-authentication)

rmi-chat:
	$(call rmi,Chat,conduit-chat)

rmi-cms:
	$(call rmi,CMS,conduit-cms)

rmi-database:
	$(call rmi,Database,conduit-database)

rmi-email:
	$(call rmi,Email,conduit-email)

rmi-forms:
	$(call rmi,Forms,conduit-forms)

rmi-push-notifications:
	$(call rmi,PushNotifications,conduit-push-notifications)

rmi-sms:
	$(call rmi,SMS,conduit-sms)

rmi-storage:
	$(call rmi,Storage,conduit-storage)

rmi-ui:
	$(call rmi,Conduit Admin Panel,conduit-ui)

rmi-redis:
	$(call rmi,Redis,conduit-redis)

rmi-mongo:
	$(call rmi,MongoDB,conduit-mongo)

rmi-postgres:
	$(call rmi,PostgreSQL,conduit-postgres)

# ------- Dependencies ------- #

# Params: image-name, path/to/Dockerfile, path
define build_dep
	@if ${DOCKER} image ls | grep ${1} > /dev/null 2>&1; then \
		echo -e "\n${1} dependency image already exists"; \
	else \
		echo -e "\nBulding ${1} dependency image"; \
		${DOCKER} build -t ${1} -f ${2} `dirname ${2}`; \
	fi
endef

build-conduit-base:
	$(call build_dep,conduit-base,${CWD}/../Dockerfile)

build-conduit-builder:
	$(call build_dep,conduit-builder,${CWD}/../scripts/Dockerfile.builder)

rmi-conduit-deps:
	$(call rmi,Conduit Base (Dependency),conduit-base)
	$(call rmi,Conduit Builder (Dependency),conduit-builder)
