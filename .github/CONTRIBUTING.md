# Conduit Contributing Guide

Welcome! We are really excited that you are interested in contributing to Conduit.

Before submitting your contribution, please make sure to take a moment and read through the following guidelines:

- [Code of Conduct](https://github.com/ConduitPlatform/Conduit/blob/main/.github/CODE_OF_CONDUCT.md)
- [Issue Reporting Guidelines](#issue-reporting-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)

## Issue Reporting Guidelines

- When you are creating a bug report, please include as many details as possible. 

- Before creating issue reports, perform a cursory search to see if the problem has already been reported. If it has and the issue is still open, add a comment to the existing issue instead of opening a new one.

- If you find a Closed issue that seems like it is the same thing that you're experiencing, open a new issue and include a link to the original issue in the body of your new one.

## Pull Request Guidelines

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
- Node.js >=16
- [protoc](https://grpc.io/docs/protoc-installation)
- MongoDB or PostgreSQL
- Redis
- Desire to create something awesome

After cloning the repo, run:

``` bash
yarn --frozen-lockfile
npx lerna run build
REDIS_HOST=localhost REDIS_PORT=6379 yarn --cwd ./packages/core start
CONDUIT_SERVER=0.0.0.0:55152 SERVICE_URL=0.0.0.0:55165 DB_CONN_URI=mongodb://localhost:27017 yarn --cwd ./modules/database start
```

Then repeat the following step for every additional module you wish to bring online, specifying any additional env vars.

``` bash
CONDUIT_SERVER=0.0.0.0:55152 SERVICE_URL=0.0.0.0:PORT yarn --cwd ./modules/MODULE start
```

You may look up supported envs and configuration options for your modules in the [modules section of the documentation](https://getconduit.dev/docs/modules).

### Committing Changes

Commit messages should follow the [commit message convention](https://github.com/ConduitPlatform/Conduit/blob/main/.github/COMMIT_CONVENTION.md) so that changelogs can be automatically generated.

### Commonly Used Commands

``` bash
# Building Everything
npx lerna run build

# Building Individual Modules (eg: Database)
npx lerna run build --scope=@conduitplatform/database

# Running a module with env vars
CONDUIT_SERVER="0.0.0.0:55152" SERVICE_IP="0.0.0.0:55183" \
npx lerna run start --scope=@conduitplatform/database
```

Find out more about [Lerna](https://lerna.js.org/).

You may find additional scripts in the `scripts` section of the `package.json` file.

## Project Structure

- **`packages`**: contains *core modules* built into the "Core" package
    - `admin`: provides administrative APIs (using `Hermes`)
    - `commons`: SDK for *core module* intracommunication
    - `core`: entrypoint, handles module configuration and service discovery

- **`modules`**: contains *non-core modules*
    - `authentication`: provides user authentication
    - `authorization`: resource authorization based on Google Zanzibar
    - `chat`: chat room functionality
    - `database`: database engine (MongoDB, PostgreSQL), CMS, CRUD/functional endpoint generation
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

## License

By contributing to Conduit & Conduit Platform repositories, you agree that your contributions will be licensed under the license specified in the repository you are contributing to.
    
## Credits

Thank you to all the awesome people who have already contributed to Conduit!

<a href="https://github.com/conduitplatform/conduit/graphs/contributors"><img src="https://contrib.rocks/image?repo=conduitplatform/conduit" /></a>
