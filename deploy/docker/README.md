# Running Conduit on Docker Compose

We offer 2 methods of running Conduit, either in microservices mode or standalone.

The standalone version is a monolithic version of Conduit, that can be easier to work with, while the microservices
version is more flexible and scalable.

The standalone version is using pm2 to spin up the services in a single container. While the microservices version is
using docker-compose to spin up the services in separate containers.

## Standalone

To run the standalone version:

1. `git clone https://github.com/ConduitPlatform/Conduit.git`
2. `cd Conduit/docker`
3. `docker-compose -f docker-compose.standalone.yml up` or `docker-compose -f docker-compose.standalone.yml up -d` to
   run in detached mode.
4. Open the admin panel in your browser at [http://localhost:8080](http://localhost:8080)

## Microservices

To run the microservices version:

1. `git clone
2. `cd Conduit/docker`
3. `docker-compose up` or `docker-compose up -d` to run in detached mode.

- Open the admin panel in your browser at [http://localhost:8080](http://localhost:8080)
- Open the router in your browser at [http://localhost:8081](http://localhost:8081)
- You can inject `--profile {profile_name}` command on compose to configure more services
