FROM node:dubnium

WORKDIR /app

COPY --from=conduit-base:latest /app/libraries /app/libraries
COPY --from=conduit-base:latest /app/modules/authentication /app/modules/authentication
COPY --from=conduit-base:latest /app/node_modules /app/node_modules

WORKDIR /app/modules/authentication

ENV CONDUIT_SERVER conduit_server
 
ENV SERVICE_URL 0.0.0.0:5000

ENV REGISTER_NAME true

EXPOSE 5000

CMD ["yarn", "start"]
