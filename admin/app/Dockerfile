FROM node:dubnium

WORKDIR /app

COPY --from=conduit-base:latest /app/admin/app /app/admin/app
COPY --from=conduit-base:latest /app/node_modules /app/node_modules

WORKDIR /app/admin/app

EXPOSE 3000

CMD ["yarn", "start"]
