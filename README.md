[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
![.github/workflows/development.yml](https://github.com/Quintessential-SFT/conduit/workflows/.github/workflows/development.yml/badge.svg?branch=master)

# Conduit Platform

Conduit is a NodeJS-based Backend as a Server, that aims to cut down development times
by providing ready-made modules that offer common functionality out of the box, and allowing
maximum flexibility to add custom functionality.

## Features
- Transports: REST, GraphQL, WebSockets(via Socket.io) and grpc
- Database Support for MongoDB and PostgreSQL(alpha)
- In-memory database through Redis
- All functionalities and routes available both as REST and GraphQL endpoints
- CMS module to create and edit schemas from the admin panel and also 
  add custom logic through the "custom endpoints" functionality
- Swagger docs and GraphQL explorer with full route documentation
- Authentication system with JWT and 2FA, supporting ServiceAccounts/API keys as well as
local(username/password or email/password), oAuth(Facebook, Google, Twitch, KakaoTalk)
- Basic security built-in with Client Id/secret for all requests, rate limiting and helmet.
- Emails with template support
- SMS for 2FA or plain SMS send
- Storage using either GCS or Azure Blob Storage (S3 coming soon)
- Chat(alpha)
- Forms for basic form submission and forwarding to email
- Payments with Stripe
- Custom workflows with "Actor" (WIP)
- Conduit SDK can be used to add new modules or custom services
- so much more

### Requirements

- NodeJS > 14
- MongoDB or PostgreSQL
- Desire to create something awesome

### Running

- yarn
- npx lerna run build
- cd ./packages/core && yarn start
- cd ./modules/database && yarn start
- repeat for every module you need to bring online


## Info

- Core HTTP Server runs at: http://localhost:3000
- Core Grpc Server runs at: localhost:55152
- Core Socket Server runs at: localhost:3001
