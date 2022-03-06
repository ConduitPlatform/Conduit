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

Conduit is a NodeJS-based Backend as a Service, that aims to cut down development times
by providing ready-made modules that offer common functionality out of the box, and allowing
maximum flexibility to add custom functionality.

Check out our docs here: [Documentation](https://getconduit.dev/docs)

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
- Storage using either GCS or Azure Blob Storage (S3 coming soon)
- Chat
- Forms for basic form submission and email forwarding
- Conduit SDK can be used to add new modules or custom services
- so much more

# Requirements ⚡

- NodeJS > 14
- MongoDB or PostgreSQL
- Desire to create something awesome
# Quickstart
This script uses docker compose to spin up some basic modules for you to test.
```sh
source <(curl -s https://getconduit.dev/bootstrap)
```
Open http://localhost:8080 to check the admin panel username:admin password: admin

Your API will be on http://localhost:3000

Checkout swagger on: /swagger

Checkout GraphQL on /graphql (you'll need to generate clientid/secret throught the admin panel to access)

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

|  Variable        |  Description   | Required |  Example        |
| :--------------: | :------------- | :------: | :-------------: |
| `REDIS_HOST`     | Redis address  |   True   | `localhost`     |
| `REDIS_PORT`     | Redis port     |   True   | `6379`          |

### Database

|  Variable        |  Description   | Required |  Example        |  Default                    |
| :--------------: | :------------- | :------: | :-------------: | :-------------------------: |
| `databaseURL`    | database URL   |  False   | `localhost`     | `mongodb://localhost:27017` |
| `databaseType`   | db engine type |  False   | `sql`           | `mongodb`                   |

Generic module env variables are also supported, with required ones being obligatory.

### Generic Module

|  Variable        |  Description                                  | Required |  Example        |
| :--------------: | :-------------------------------------------- | :------: | :-------------: |
| `CONDUIT_SERVER` | Conduit Core's address and port               |   True   | `0.0.0.0:55152` |
| `SERVICE_IP`     | Always 0.0.0.0 and a port numer               |   True   | `0.0.0.0:55190` |
| `SERVICE_URL`    | **Deprecated** in v0.11, same as `SERVICE_IP` | ~~True~~ | `0.0.0.0:55190` |
| `REGISTER_NAME`  | Set to `true` if running in Kubernetes        |   False  | `true`          |

## Information ℹ️

- Core HTTP Server runs at: `http://localhost:3000`
- Core Grpc Server runs at: `localhost:55152`
- Core Socket Server runs at: `localhost:3001`
- Admin Server runs at: `localhost:8080`

# Roadmap 🏁

- Payments module to facilitate payments with Stripe, BrainTree etc
- Custom workflows with "Actor"
- Optimization
