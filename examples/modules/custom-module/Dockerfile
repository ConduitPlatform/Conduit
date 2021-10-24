FROM node:fermium-alpine

# Copy all files from the module

WORKDIR /app

COPY . .

WORKDIR /app

# Install dependencies and build the module
RUN yarn

RUN yarn build

# The URL where the code module is reachable
ENV CONDUIT_URL conduit_server

# The URL that the module will publish to the core, if REGISTER_NAME=false
ENV SERVICE_URL 0.0.0.0:5000

# If set to true, the module will publish its name and not its url. This is used when deploying to k8s
ENV REGISTER_NAME true

EXPOSE 5000

CMD ["yarn", "start"]
