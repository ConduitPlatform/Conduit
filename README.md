<p align="center">
<br>
<a href="https://getconduit.dev" target="_blank"><img src="https://getconduit.dev/conduitLogo.svg" alt="logo"/></a>
<br/>
<strong>The only Backend you'll ever need. Written in NodeJS, works with any stack</strong>
</p>

[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/ConduitPlatform/Conduit)
![GitHub](https://img.shields.io/github/license/ConduitPlatform/Conduit)
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/ConduitPlatform/Conduit)
# Conduit Platform

Conduit is a NodeJS-based Self-Hosted backend, that aims to cut down development times
by providing ready-made modules that offer common functionality out of the box, and allowing
maximum flexibility to add custom functionality.

Check out our docs here: [Documentation](https://getconduit.dev/docs/overview/intro)\
Wanna see what come next: [Roadmap](https://sharing.clickup.com/1554325/b/h/1fdwn-7561/8b09d2e9aedec0b)\
Help us make Conduit great: [Contribute](https://github.com/ConduitPlatform/Conduit/blob/main/.github/CONTRIBUTING.md)\
Learn more: [Website](https://getconduit.dev)

# Features ✔️

- Transports: REST, GraphQL, WebSockets (via Socket.io) and gRPC
- Database support for MongoDB and PostgreSQL (alpha)
- In-memory database through Redis
- All functionalities and routes available both as REST and GraphQL endpoints
- CMS module to create and edit schemas from the admin panel and also 
  add custom logic through the "custom endpoints" functionality
- Swagger docs and GraphQL explorer with full route documentation
- Authentication system with JWT and 2FA, supporting ServiceAccounts/API keys as well as
local(username/password or email/password), oAuth(Facebook, Google, Twitch)
- Basic security built-in with Client Id/secret for all requests, rate limiting and Helmet.
- Emails with template support
- SMS for 2FA or plain SMS send
- Storage using S3, GCS and  Azure Blob Storage 
- Chat
- Forms for basic form submission and email forwarding
- Conduit SDK can be used to add new modules or custom services
- so much more

# Requirements ⚡

- NodeJS > 14 or Docker
- MongoDB or SQL (PostgreSQL, MySQL, MariaDB, MSSQL)
- Desire to create something awesome

# Quickstart
This script uses docker compose to spin up some basic modules for you to test.
```sh
source <(curl -s https://getconduit.dev/bootstrap)
```
Open http://localhost:8080 to check the admin panel (username:admin, password: admin)

Your API will be on http://localhost:3000

Check out Swagger on: `/swagger` and `/admin/swagger`

Check out GraphQL on `/graphql` (you'll need to generate clientid/secret through the admin panel to access)

# Running from source 🔨

```sh
yarn
npx lerna run build
REDIS_HOST=localhost REDIS_PORT=6379 yarn --cwd ./packages/core start
CONDUIT_SERVER=0.0.0.0:55152 SERVICE_IP=0.0.0.0:55165 yarn --cwd ./modules/database start
```

Then repeat the last step for every additional module you need to bring online.

```sh
CONDUIT_SERVER=0.0.0.0:55152 SERVICE_IP=0.0.0.0:PORT yarn --cwd ./modules/MODULE start
```

## Environment Variables 📃 <a name="env-vars"></a>

### Core:

|   Variable   | Description   | Required |   Example   |
|:------------:|:--------------|:--------:|:-----------:|
| `REDIS_HOST` | Redis Address |   True   | `localhost` |
| `REDIS_PORT` | Redis Port    |   True   |   `6379`    |
| `MASTER_KEY` | Master Secret |  False   | `M4ST3RK3Y` |

### Database

|   Variable    | Description       | Required |                     Example                      |  Default                    |
|:-------------:|:------------------| :------: |:------------------------------------------------:| :-------------------------: |
| `DB_CONN_URI` | DB Connection URI |  False   | `postgres://conduit:pass@localhost:5432/conduit` | `mongodb://localhost:27017` |
|   `DB_TYPE`   | DB Engine Type    |  False   |                    `postgres`                    | `mongodb`                   |

Generic module env variables are also supported, with required ones being obligatory.

### Generic Module

|                 Variable                 | Description                                                           | Required |      Example       |
|:----------------------------------------:|:----------------------------------------------------------------------| :------: |:------------------:|
|             `CONDUIT_SERVER`             | Conduit Core's address and port                                       |   True   |  `0.0.0.0:55152`   |
|               `SERVICE_IP`               | Always 0.0.0.0 and a port numer                                       |   True   |  `0.0.0.0:55190`   |
|             `REGISTER_NAME`              | Set to `true` if running in Kubernetes                                |   False  |       `true`       |
|               `GRPC_KEY`                 | Specify a key to enable gRPC protection (must be used across modules) |   False  | `H+MbQeThWmZq4t6w` |
| `DEBUG__DISABLE_INACTIVE_MODULE_REMOVAL` | Prevent removal of inactive modules from Config                       |   False  |       `true`       |

## Information ℹ️

- Core HTTP Server runs at: `http://localhost:3000`
- Core Grpc Server runs at: `localhost:55152`
- Core Socket Server runs at: `localhost:3001` (Socket.io, handshake path: `/realtime`)
- Admin Server runs at: `localhost:8080`
