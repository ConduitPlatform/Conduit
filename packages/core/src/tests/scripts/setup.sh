docker stop conduit-redis && docker rm conduit-redis
docker run --name conduit-redis -d -p 6379:6379 redis:latest