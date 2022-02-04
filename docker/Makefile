.PHONY: zero-to-hero setup start-conduit start-all stop-all clean mrproper \
				pull-core start-core stop-core rm-core rmi-core \
				pull-authentication start-authentication stop-authentication rm-authentication rmi-authentication \
				pull-cms start-cms stop-cms rm-cms rmi-cms \
				pull-chat start-chat stop-chat rm-chat rmi-chat \
				pull-database start-database stop-database rm-database rmi-database \
				pull-email start-email stop-email rm-email rmi-email \
				pull-forms start-forms stop-forms rm-forms rmi-forms \
				pull-push-notifications start-push-notifications stop-push-notifications rm-push-notifications rmi-push-notifications \
				pull-sms start-sms stop-sms rm-sms rmi-sms \
				pull-storage start-storage stop-storage rm-storage rmi-storage \
				pull-ui start-ui stop-ui rm-ui rmi-ui \
				start-redis stop-redis rm-redis rmi-redis \
				start-mongo stop-mongo rm-mongo rmi-mongo \
				start-postgres stop-postgres rm-postgres rmi-postgres

# ------ Default Values ------ #

TAG        ?= v0.10.6
DOCKER     ?= sudo docker
CONTAINER_NETWORK_NAME ?= "conduit"
DB_TYPE    ?= "mongodb"
DB_URL     ?= "mongodb://conduit-mongo:27017"
CONDUIT_CORE_NETWORK_NAME = conduit
CONDUIT_URL = "http://localhost:3000"

# ------ Common Targets ------ #

zero-to-hero:
	@$(MAKE) --no-print-directory setup
	@$(MAKE) --no-print-directory start-conduit
	@echo -e "\nModules Being Brought Up ⚙️"
	@echo      "---------------------------"
	@echo "- database"
	@echo "- authentication"
	@echo "- cms"
	@echo -e "\n\nLog into your admin panel in http://localhost:8080"
	@echo "Credentials: admin:admin"

setup:
	@echo -e "\nInitializing Conduit Container Environment 🔨"
	@echo -e "This may take a while. Better bring up Reddit 😅"
	@echo -e "------------------------------------------------"
	@${DOCKER} network create ${CONTAINER_NETWORK_NAME} > /dev/null 2>&1 || true
	@$(MAKE) --no-print-directory pull-core
	@$(MAKE) --no-print-directory pull-database
	@$(MAKE) --no-print-directory pull-authentication
	@$(MAKE) --no-print-directory pull-cms
	@$(MAKE) --no-print-directory pull-ui
	@echo -e "\n\nInstallation was successful ✔️\n"

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
	@echo -e "\n\nRemoving Container Network 📡"
	@echo        "-----------------------------"
	@if ${DOCKER} network ls | grep ${CONTAINER_NETWORK_NAME} > /dev/null 2>&1; then \
		${DOCKER} network rm ${CONTAINER_NETWORK_NAME} > /dev/null 2>&1; \
		echo "Removed \"${CONTAINER_NETWORK_NAME}\" network."; \
	else \
		echo "Network already removed"; \
	fi

# ----- Docker Functions ----- #

# Params: module name, project, image-name, tag
define pull
	@if [[ `${DOCKER} images -q ${3}:${4}` ]]; then \
		echo -e "\n${1} image already exists"; \
	else \
		echo -e "\nPulling ${1} image"; \
		${DOCKER} pull ghcr.io/${2}/${3}:${4}; \
	fi
endef

# Params: module name, container-name, image-name, tag, network-name, docker args (optional)
define start
	@if ${DOCKER} container ls | grep ${2} > /dev/null 2>&1; then \
		echo -e "\n${1} container already running"; \
	elif ${DOCKER} container ls -a | grep ${2} > /dev/null 2>&1; then \
		echo -e "\nStarting ${1} container"; \
		${DOCKER} start ${2}; \
	else \
		${DOCKER} image ls | grep ${2} > /dev/null 2>&1 || \
			$(MAKE) --no-print-directory `echo ${2} | sed 's/^[^-]*-/pull-/g'`; \
		echo -e "\nStarting ${1} container"; \
		echo ${DOCKER} run --name ${2} --network-alias ${5} --network ${CONTAINER_NETWORK_NAME} -h ${2} ${6} ${3}:${4}; \
		${DOCKER} run --name ${2} --network-alias ${5} --network ${CONTAINER_NETWORK_NAME} -h ${2} ${6} ${3}:${4}; \
	fi
endef

# Params: module name, container-name
define stop
	@if ${DOCKER} container ls | grep ${2} > /dev/null 2>&1; then \
		echo -e "\nStopping ${1} container"; \
		${DOCKER} stop ${2}; \
	else \
		echo -e "\n${1} container not running"; \
	fi
endef

# Params: module name, container-name
define rm
	@if ${DOCKER} container ls -a | grep ${2} > /dev/null 2>&1; then \
		echo -e "\nRemoving ${1} container"; \
		${DOCKER} container rm ${2}; \
	else \
		echo -e "\n${1} does not have an available container"; \
	fi
endef

# Params: module name, image-name, tag
define rmi
	@if [[ `${DOCKER} images -q ${2}:${3}` ]]; then \
		echo -e "\nRemoving ${1} image"; \
		${DOCKER} image rm ${2}; \
	else \
		echo -e "\n${1} does not have an available image"; \
	fi
endef

# ------- Base Targets ------- #

pull-core:
	$(call pull,Conduit Core,conduitplatform,conduit,${TAG})

pull-authentication:
	$(call pull,Authentication,conduitplatform,conduit-authentication,${TAG})

pull-chat:
	$(call pull,Chat,conduitplatform,conduit-chat,${TAG})

pull-cms:
	$(call pull,CMS,conduitplatform,conduit-cms,${TAG})

pull-database:
	$(call pull,Database,conduitplatform,conduit-database,${TAG})

pull-email:
	$(call pull,Email,conduitplatform,conduit-email,${TAG})

pull-forms:
	$(call pull,Forms,conduitplatform,conduit-forms,${TAG})

pull-push-notifications:
	$(call pull,PushNotifications,conduitplatform,conduit-push-notifications,${TAG})

pull-sms:
	$(call pull,SMS,conduitplatform,conduit-sms,${TAG})

pull-storage:
	$(call pull,Storage,conduitplatform,conduit-storage,${TAG})

pull-ui:
	$(call pull,Storage,conduitplatform,conduit-ui,${TAG})

start-core:
	@$(MAKE) --no-print-directory start-redis
	$(call start,Core,conduit-core,conduit,${TAG},${CONDUIT_CORE_NETWORK_NAME}, \
         -d -p 55152:55152 -p 3000:3000 -p 3001:3001 -e REDIS_HOST="conduit-redis" -e REDIS_PORT="6379")

start-authentication:
	$(call start,Authentication,conduit-authentication,conduit-authentication,${TAG},authentication, \
         -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-chat:
	$(call start,Chat,conduit-chat,conduit-chat,${TAG},chat, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-cms:
	$(call start,CMS,conduit-cms,conduit-cms,${TAG},cms, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-database:
	@if [ ${DB_TYPE} == "mongodb" ]; then \
		make start-mongo; \
	elif [ ${DB_TYPE} == "sql" ]; then \
		make start-postgres; \
	else \
		echo -e "\nInvalid DB_TYPE override. Choose between 'mongodb' and 'sql' (default: mongodb)"; \
		exit 1; \
	fi
	$(call start,Database,conduit-database,conduitplatform/conduit-database,${TAG},database --network-alias database-provider, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152" \
	       -e databaseType=${DB_TYPE} -e databaseURL=${DB_URL})

start-email:
	$(call start,Email,conduit-email,conduit-email,${TAG},email, \
         -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-forms:
	$(call start,Forms,conduit-forms,conduit-forms,${TAG},forms, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-push-notifications:
	$(call start,PushNotifications,conduit-push-notifications,conduit-push-notifications,${TAG},push-notifications, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-sms:
	$(call start,SMS,conduit-sms,conduit-sms,${TAG},sms, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-storage:
	$(call start,Storage,conduit-storage,conduit-storage,${TAG},storage, \
	       -d -e REGISTER_NAME="true" -e CONDUIT_SERVER="conduit-core:55152")

start-ui:
	$(call start,Conduit Admin Panel,conduit-ui,conduit-ui,${TAG},conduit-ui, \
	       -d -p 8080:8080 -e CONDUIT_URL=${CONDUIT_URL})

start-redis:
	$(call start,Redis,conduit-redis,redis,latest,redis,-d -p 6379:6379)

start-mongo:
	$(call start,MongoDB,conduit-mongo,mongo,latest,mongo,-d -p 27017:27017)

start-postgres:
	$(call start,PostgreSQL,conduit-postgres,postgres,latest,postgres,-d -p 5432:5432)

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
	$(call rmi,Conduit Core,conduit,${TAG})

rmi-authentication:
	$(call rmi,Authentication,conduit-authentication,${TAG})

rmi-chat:
	$(call rmi,Chat,conduit-chat,${TAG})

rmi-cms:
	$(call rmi,CMS,conduit-cms,${TAG})

rmi-database:
	$(call rmi,Database,conduit-database,${TAG})

rmi-email:
	$(call rmi,Email,conduit-email,${TAG})

rmi-forms:
	$(call rmi,Forms,conduit-forms,${TAG})

rmi-push-notifications:
	$(call rmi,PushNotifications,conduit-push-notifications,${TAG})

rmi-sms:
	$(call rmi,SMS,conduit-sms,${TAG})

rmi-storage:
	$(call rmi,Storage,conduit-storage,${TAG})

rmi-ui:
	$(call rmi,Conduit Admin Panel,conduit-ui,${TAG})

rmi-redis:
	$(call rmi,Redis,conduit-redis,${TAG})

rmi-mongo:
	$(call rmi,MongoDB,conduit-mongo,${TAG})

rmi-postgres:
	$(call rmi,PostgreSQL,conduit-postgres,${TAG})
