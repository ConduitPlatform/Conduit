# Conduit Contributing Guide

Welcome! We are really excited that you are interested in contributing to Conduit.

Before submitting your contribution, please make sure to take a moment and read through the following guidelines:

- [Code of Conduct](https://github.com/ConduitPlatform/Conduit/blob/main/.github/CODE_OF_CONDUCT.md)
- [Issue Reporting Guidelines](#issue-reporting-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)

## Issue Reporting Guidelines 🐛

- When you are creating a bug report, please include as many details as possible.

- Before creating issue reports, perform a cursory search to see if the problem has already been reported. If it has and the issue is still open, add a comment to the existing issue instead of opening a new one.

- If you find a Closed issue that seems like it is the same thing that you're experiencing, open a new issue and include a link to the original issue in the body of your new one.

## Pull Request Guidelines ✨

- Checkout a topic branch from `main`, and merge back.

- It's OK to have multiple small commits as you work on the PR - GitHub will automatically squash it before merging.

- If adding a new feature:
  - Add accompanying test case.
  - Provide a convincing reason to add this feature. Ideally, you should open a suggestion issue first and have it approved before working on it.

- If fixing a bug:
  - If you are resolving a reported issue, add `(fix #xxx)` (#xxx is the issue id) in your PR title for a better release log, e.g. `update entities encoding/decoding (fix #389)`.
  - Provide a detailed description of the bug in the PR and the steps to reproduce it.

- **DO NOT** change `.gitignore`.

## Development Setup 🔨

### Requirements:

- Node.js >=24
- [pnpm](https://pnpm.io/installation) 10.9.x (same major/minor as root `package.json` `packageManager`). Install via Corepack, npm global, or another supported method; match Node in `.nvmrc` (24+)
- [protoc](https://grpc.io/docs/protoc-installation)
- MongoDB or PostgreSQL
- Redis
- Desire to create something awesome

After cloning the repo, run:

```bash
pnpm install --frozen-lockfile
turbo run build
REDIS_HOST=localhost REDIS_PORT=6379 pnpm --filter @conduitplatform/core start
CONDUIT_SERVER=0.0.0.0:55152 SERVICE_URL=0.0.0.0:55165 DB_CONN_URI=mongodb://localhost:27017 pnpm --filter @conduitplatform/database start
```

Then repeat the following step for every additional module you wish to bring online, specifying any additional env vars. Replace the filter segment with the package name for that module (the folder name under `modules/`, e.g. `chat`, `router`, `storage` — not the literal word `MODULE`).

```bash
CONDUIT_SERVER=0.0.0.0:55152 SERVICE_URL=0.0.0.0:PORT pnpm --filter @conduitplatform/chat start
```

You may look up supported envs and configuration options for your modules in the [modules section of the documentation](https://getconduit.dev/docs/modules).

### Redis Configuration

Core reads its Redis connection from the environment and serves it to modules over gRPC, so modules
only need these variables if they should connect differently from Core.

| Variable                           | Description                                                                                                                                                                                                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REDIS_HOST`, `REDIS_PORT`         | Standalone Redis address                                                                                                                                                                                                                                                                  |
| `REDIS_DB`                         | Database index (default `0`)                                                                                                                                                                                                                                                              |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | Redis ACL credentials. Ignored when `REDIS_CONFIG` is set: put them in it instead (`options.redisOptions` for cluster)                                                                                                                                                                    |
| `REDIS_CONFIG`                     | JSON ioredis options, or `{ "nodes": [...], "options": {...} }` for Redis Cluster. Takes precedence over `REDIS_HOST`/`REDIS_PORT`                                                                                                                                                        |
| `REDIS_KEY_PREFIX`                 | Deployment-wide namespace for every Redis key **and** pub/sub channel (e.g. `tenant-a:`). Overrides a `keyPrefix` in `REDIS_CONFIG` (`options.keyPrefix` for cluster, with `options.redisOptions.keyPrefix` read as a fallback). Unset keeps the un-namespaced layout on standalone Redis |

A `:` is appended if the prefix doesn't end with one, so deployments like `a` and `ab` can't
overlap. It is composed with Conduit's internal prefixes
(`<prefix>bus_…`, `<prefix><module>_…`), BullMQ queues live under `<prefix>bull:…` (`<prefix>{bull}:…` on Redis Cluster if the prefix has no hash tag), Socket.IO adapter
streams/sessions under `<prefix>socket.io:…`/`<prefix>sio:session:…`, and EventBus channels are
published as `<prefix><channel>`.

This lets several Conduit deployments share one Redis, each with its own ACL user restricted to its
namespace:

```bash
redis-cli ACL SETUSER tenant-a on '>s3cret' resetchannels '~tenant-a:*' '&tenant-a:*' +@all -@dangerous +info
REDIS_KEY_PREFIX=tenant-a: REDIS_USERNAME=tenant-a REDIS_PASSWORD=s3cret \
REDIS_HOST=localhost REDIS_PORT=6379 pnpm --filter @conduitplatform/core start
```

On Redis Cluster, give the prefix a hash tag, e.g. `REDIS_KEY_PREFIX={tenant-a}:` with ACL
`~{tenant-a}:* &{tenant-a}:*`. All of a deployment's keys then share one slot, so deployments spread
across nodes (a deployment must fit on one node). Create the ACL user on every cluster node, as ACLs
aren't propagated. An unbraced or missing prefix still works (BullMQ falls back to `{bull}`), but all
such deployments' BullMQ keys then share one slot and node. Empty tags (`{}`) are rejected. Standalone
Redis ignores the braces.

`-@dangerous` is required for isolation: with plain `+@all` a tenant can still run `ACL SETUSER`,
`MONITOR`, `CONFIG SET` or `FLUSHALL`. It also removes `INFO`, which BullMQ and ioredis need, hence
`+info`.

**Upgrading:**

- Every Core and module instance of a deployment must run a grpc-sdk with prefix support before the
  prefix is enabled. Modules that set their own `REDIS_*` variables need `REDIS_KEY_PREFIX` too.
- Enabling or changing the prefix needs a stop/start of Core and all modules, not a rolling deploy:
  modules build their Redis clients and EventBus once at startup. The deployment starts with an empty
  namespace; sessions, caches, locks and queued jobs under the old layout are not migrated.
- On Redis Cluster, per-client prefixes (`bus_`, `<module>_`, `auth_metrics_`) are now applied even
  without `REDIS_KEY_PREFIX`, which renames those keys. Upgrade cluster deployments with a stop/start
  too, or old and new pods hold separate locks (e.g. two realtime change-stream leaders).

**Custom code using `redisManager`:**

- ioredis doesn't prefix `SCAN`/`KEYS`/`PSUBSCRIBE` patterns, but returned key names include the
  prefix: match on `${redisManager.prefix}doc:*` and strip the prefix yourself.
- `duplicate()` keeps the `keyPrefix`, so a duplicated prefixed client still can't be given to BullMQ.
  Use `getUnprefixedClient()` with `bullMQOptions()`.

### Committing Changes

Commit messages should follow the [commit message convention](https://github.com/ConduitPlatform/Conduit/blob/main/.github/COMMIT_CONVENTION.md) so that changelogs can be automatically generated.

### Commonly Used Commands

```bash
# Building Everything
turbo run build

# Building Individual Modules (eg: Database)
turbo run build --filter=@conduitplatform/database

# Running a module with env vars
CONDUIT_SERVER="0.0.0.0:55152" SERVICE_IP="0.0.0.0:55183" \
pnpm --filter @conduitplatform/database start
```

Find out more about [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/repo/docs).

You may find additional scripts in the `scripts` section of the `package.json` file.

## Project Structure 📍

- **`packages`**: contains _core modules_ built into the "Core" package
  - `admin`: provides administrative APIs (using `Hermes`)
  - `commons`: SDK for _core module_ intracommunication
  - `core`: entrypoint, handles module configuration and service discovery

- **`modules`**: contains _non-core modules_
  - `authentication`: provides user authentication
  - `authorization`: resource authorization based on Google Zanzibar
  - `chat`: chat room functionality
  - `database`: database engine (MongoDB, PostgreSQL), CMS, CRUD/functional endpoint generation
  - `embeddings`: opt-in text-to-vector generation and semantic search (disabled by default; not in standalone v1)
  - `email`: email sending with templates support
  - `forms`: form generation and submission
  - `push-notifications`: provides support for push notifications
  - `router`: provides application APIs (using `Hermes`)
  - `sms`: provides support for SMS communication
  - `storage`: consistent storage

- **`libraries`**: contains shared libraries
  - `grpc-sdk`: SDK for gRPC communication used by Core and modules
  - `hermes`: handles REST (+Swagger), GraphQL and WebSockets API generation
  - `node-2fa`: internal fork of [`node-2fa`](https://github.com/jeremyscalpello/node-2fa)
  - `testing-tools`: utilities for Conduit tests

- **`scripts`**: contains build-related utility scripts

- **`docker`**: contains OCI-container related utilities

- **`benchmarks`**: contains benchmarking utilities

## License ✍️

By contributing to Conduit & Conduit Platform repositories, you agree that your contributions will be licensed under the license specified in the repository you are contributing to.

## Credits 🎉

Thank you to all the awesome people who have already contributed to Conduit!

<a href="https://github.com/conduitplatform/conduit/graphs/contributors"><img src="https://contrib.rocks/image?repo=conduitplatform/conduit" /></a>
