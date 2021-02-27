FROM node:fermium

#RUN apk --no-cache add --virtual builds-deps build-base python

COPY . /app

WORKDIR /app

#RUN npm install -g yarn
RUN npm install -g node-gyp
RUN yarn && npx lerna run build

CMD ["yarn", "start"]
