.PHONY: zero-to-hero setup start-conduit start-all stop-all clean mrproper \
				start-core stop-core rm-core rmi-core \
				start-authentication stop-authentication rm-authentication rmi-authentication \
				start-chat stop-chat rm-chat rmi-chat \
				start-database stop-database rm-database rmi-database \
				start-email stop-email rm-email rmi-email \
				start-forms stop-forms rm-forms rmi-forms \
				start-push-notifications stop-push-notifications rm-push-notifications rmi-push-notifications \
				start-sms stop-sms rm-sms rmi-sms \
				start-storage stop-storage rm-storage rmi-storage \
				start-ui stop-ui rm-ui rmi-ui \
				start-redis stop-redis rm-redis rmi-redis \
				start-mongo stop-mongo rm-mongo rmi-mongo \
				start-postgres stop-postgres rm-postgres rmi-postgres

# ------ Default Values ------ #

TAG        ?= v0.12.2
UI_TAG     ?= v0.12.0
DOCKER     ?= docker
CONTAINER_NETWORK_NAME ?= "conduit"
DB_TYPE    ?= "mongodb"
DB_URL     ?= "mongodb://conduit-mongo:27017"
CONDUIT_CORE_NETWORK_NAME = conduit
CONDUIT_URL = "http://localhost:3000"
MASTER_KEY  = "M4ST3RK3Y"

# ------ Common Targets ------ #

zero-to-hero:
	@$(MAKE) --no-print-directory setup
	@$(MAKE) --no-print-directory start-conduit
	@printf "\nModules Being Brought Up ⚙️\n"
	@echo     "--------------------------"
	@echo "- database"
	@echo "- authentication"
	@printf "\n\nLog into your admin panel in http://localhost:8080\n"
	@echo "Credentials: admin:admin"

setup:
	@printf "\nInitializing Conduit Container Environment 🔨\n"
	@echo     "This may take a while. Better bring up Reddit 😅"
	@echo     "------------------------------------------------"
	@${DOCKER} network create ${CONTAINER_NETWORK_NAME} > /dev/null 2>&1 || true
	@${DOCKER} pull ghcr.io/conduitplatform/conduit:${TAG};
	@${DOCKER} pull ghcr.io/conduitplatform/database:${TAG};
	@${DOCKER} pull ghcr.io/conduitplatform/authentication:${TAG};
	@${DOCKER} pull ghcr.io/conduitplatform/conduit-ui:${UI_TAG};
	@printf "\n\nInstallation was successful ✔️\n\n"

start-conduit:
	@$(MAKE) --no-print-directory start-core
	@sleep 3
	@$(MAKE) --no-print-directory start-database
	@sleep 0.5
	@$(MAKE) --no-print-directory start-authentication
	@$(MAKE) --no-print-directory start-ui

start-all:
	@$(MAKE) --no-print-directory start-conduit
	@sleep 1
	@$(MAKE) --no-print-directory start-database
	@sleep 0.5
	@$(MAKE) --no-print-directory start-authentication
	@sleep 0.2
	@$(MAKE) --no-print-directory start-chat
	@sleep 0.2
	@$(MAKE) --no-print-directory start-email
	@sleep 0.2
	@$(MAKE) --no-print-directory start-forms
	@sleep 0.2
	@$(MAKE) --no-print-directory start-push-notifications
	@sleep 0.2
	@$(MAKE) --no-print-directory start-sms
	@sleep 0.2
	@$(MAKE) --no-print-directory start-storage
	@$(MAKE) --no-print-directory start-ui

stop-all:
	-@$(MAKE) --no-print-directory stop-ui
	-@$(MAKE) --no-print-directory stop-authentication
	-@$(MAKE) --no-print-directory stop-chat
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
	@printf "\n\nRemoving Containers 📦\n"
	@echo       "----------------------"
	@$(MAKE) --no-print-directory stop-all
	@$(MAKE) --no-print-directory rm-redis
	@$(MAKE) --no-print-directory rm-mongo
	@$(MAKE) --no-print-directory rm-postgres
	@$(MAKE) --no-print-directory rm-ui
	@$(MAKE) --no-print-directory rm-core
	@$(MAKE) --no-print-directory rm-authentication
	@$(MAKE) --no-print-directory rm-chat
	@$(MAKE) --no-print-directory rm-database
	@$(MAKE) --no-print-directory rm-email
	@$(MAKE) --no-print-directory rm-forms
	@$(MAKE) --no-print-directory rm-push-notifications
	@$(MAKE) --no-print-directory rm-sms
	@$(MAKE) --no-print-directory rm-storage

mrproper:
	@$(MAKE) --no-print-directory clean
	@printf "\n\nRemoving Container Images 💽\n"
	@echo       "----------------------------"
	@$(MAKE) --no-print-directory rmi-redis
	@$(MAKE) --no-print-directory rmi-mongo
	@$(MAKE) --no-print-directory rmi-postgres
	@$(MAKE) --no-print-directory rmi-ui
	@$(MAKE) --no-print-directory rmi-core
	@$(MAKE) --no-print-directory rmi-authentication
	@$(MAKE) --no-print-directory rmi-chat
	@$(MAKE) --no-print-directory rmi-database
	@$(MAKE) --no-print-directory rmi-email
	@$(MAKE) --no-print-directory rmi-forms
	@$(MAKE) --no-print-directory rmi-push-notifications
	@$(MAKE) --no-print-directory rmi-sms
	@$(MAKE) --no-print-directory rmi-storage
	@printf "\n\nRemoving Container Network 📡\n"
	@echo       "-----------------------------"
	@if ${DOCKER} network ls | grep ${CONTAINER_NETWORK_NAME} > /dev/null 2>&1; then \
		${DOCKER} network rm ${CONTAINER_NETWORK_NAME} > /dev/null 2>&1; \
		echo "Removed \"${CONTAINER_NETWORK_NAME}\" network."; \
	else \
		echo "Network already removed"; \
	fi

# ----- Docker Functions ----- #

# Params: module name, container-name, image-name, tag, network-alias, docker args (optional)
define start
	@if ${DOCKER} container ls | grep ${2} > /dev/null 2>&1; then \
		printf "\n${1} container already running\n"; \
	elif ${DOCKER} container ls -a | grep ${2} > /dev/null 2>&1; then \
		printf "\nStarting ${1} container\n"; \
		${DOCKER} start ${2}; \
	else \
		printf "\nStarting ${1} container\n"; \
		${DOCKER} run --name ${2} --network-alias ${5} --network ${CONTAINER_NETWORK_NAME} -h ${2} ${6} ${3}:${4}; \
	fi
endef

# Params: module name, container-name
define stop
	@if ${DOCKER} container ls | grep ${2} > /dev/null 2>&1; then \
		printf "\nStopping ${1} container\n"; \
		${DOCKER} stop ${2}; \
	else \
		printf "\n${1} container not running\n"; \
	fi
endef

# Params: module name, container-name
define rm
	@if ${DOCKER} container ls -a | grep ${2} > /dev/null 2>&1; then \
		printf "\nRemoving ${1} container\n"; \
		${DOCKER} container rm ${2}; \
	else \
		printf "\n${1} does not have an available container\n"; \
	fi
endef

# Params: module name, image-name, tag
define rmi
	@if [[ `${DOCKER} images -q ${2}:${3}` ]]; then \
		printf "\nRemoving ${1} image\n"; \
		${DOCKER} image rm ${2}:${3}; \
	else \
		printf "\n${1} does not have an available image\n"; \
	fi
endef

# ------- Base Targets ------- #

start-core:
	@$(MAKE) --no-print-directory start-redis
	$(call start,Core,conduit-core,ghcr.io/conduitplatform/conduit,${TAG},${CONDUIT_CORE_NETWORK_NAME}, \
         -d -p 55152:55152 -p 3000:3000 -p 3001:3001 -e REDIS_HOST="conduit-redis" -e REDIS_PORT="6379")

start-authentication:
	$(call start,Authentication,conduit-authentication,ghcr.io/conduitplatform/authentication,${TAG},authentication, \
         -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-chat:
	$(call start,Chat,conduit-chat,ghcr.io/conduitplatform/chat,${TAG},chat, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-database:
	@if [ ${DB_TYPE} == "mongodb" ]; then \
		make start-mongo; \
	elif [ ${DB_TYPE} == "sql" ]; then \
		make start-postgres; \
	else \
		printf "\nInvalid DB_TYPE override. Choose between 'mongodb' and 'sql' (default: mongodb)\n"; \
		exit 1; \
	fi
	$(call start,Database,conduit-database,ghcr.io/conduitplatform/database,${TAG},database --network-alias database-provider, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152" \
	       -e databaseType=${DB_TYPE} -e databaseURL=${DB_URL})

start-email:
	$(call start,Email,conduit-email,ghcr.io/conduitplatform/email,${TAG},email, \
         -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-forms:
	$(call start,Forms,conduit-forms,ghcr.io/conduitplatform/forms,${TAG},forms, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-push-notifications:
	$(call start,PushNotifications,conduit-push-notifications,ghcr.io/conduitplatform/push-notifications,${TAG},push-notifications, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-sms:
	$(call start,SMS,conduit-sms,ghcr.io/conduitplatform/sms,${TAG},sms, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-storage:
	$(call start,Storage,conduit-storage,ghcr.io/conduitplatform/storage,${TAG},storage, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-ui:
	$(call start,Conduit Admin Panel,conduit-ui,ghcr.io/conduitplatform/conduit-ui,${UI_TAG},conduit-ui, \
	       -d -p 8080:8080 -e CONDUIT_URL=${CONDUIT_URL})

start-redis:
	$(call start,Redis,conduit-redis,docker.io/library/redis,latest,redis,-d -p 6379:6379)

start-mongo:
	$(call start,MongoDB,conduit-mongo,docker.io/library/mongo,latest,mongo,-d -p 27017:27017)

start-postgres:
	$(call start,PostgreSQL,conduit-postgres,docker.io/library/postgres,latest,postgres,-d -p 5432:5432)

stop-core:
	$(call stop,Conduit Core,conduit-core)

stop-authentication:
	$(call stop,Authentication,conduit-authentication)

stop-chat:
	$(call stop,Chat,conduit-chat)

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
	$(call rmi,Conduit Core,ghcr.io/conduitplatform/conduit,${TAG})

rmi-authentication:
	$(call rmi,Authentication,ghcr.io/conduitplatform/authentication,${TAG})

rmi-chat:
	$(call rmi,Chat,ghcr.io/conduitplatform/chat,${TAG})

rmi-database:
	$(call rmi,Database,ghcr.io/conduitplatform/database,${TAG})

rmi-email:
	$(call rmi,Email,ghcr.io/conduitplatform/email,${TAG})

rmi-forms:
	$(call rmi,Forms,ghcr.io/conduitplatform/forms,${TAG})

rmi-push-notifications:
	$(call rmi,PushNotifications,ghcr.io/conduitplatform/push-notifications,${TAG})

rmi-sms:
	$(call rmi,SMS,ghcr.io/conduitplatform/sms,${TAG})

rmi-storage:
	$(call rmi,Storage,ghcr.io/conduitplatform/storage,${TAG})

rmi-ui:
	$(call rmi,Conduit Admin Panel,ghcr.io/conduitplatform/conduit-ui,${UI_TAG})

rmi-redis:
	$(call rmi,Redis,conduit-redis,${TAG})

rmi-mongo:
	$(call rmi,MongoDB,conduit-mongo,${TAG})

rmi-postgres:
	$(call rmi,PostgreSQL,conduit-postgres,${TAG})
