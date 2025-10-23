FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
COPY modules/communications/package.json ./modules/communications/
COPY libraries/grpc-sdk/package.json ./libraries/grpc-sdk/
COPY libraries/module-tools/package.json ./libraries/module-tools/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY modules/communications ./modules/communications
COPY libraries/grpc-sdk ./libraries/grpc-sdk
COPY libraries/module-tools ./libraries/module-tools

# Build the module
WORKDIR /app/modules/communications
RUN npm run build

# Expose port
EXPOSE 5000

# Start the service
CMD ["npm", "start"]
