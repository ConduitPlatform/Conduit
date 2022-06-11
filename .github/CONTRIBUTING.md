# Conduit Contributing Guide

Welcome! We are really excited that you are interested in contributing to Conduit. Before submitting your contribution, please make sure to take a moment and read through the following guidelines:

- [Code of Conduct](https://github.com/ConduitPlatform/Conduit/blob/master/.github/CODE_OF_CONDUCT.md)
- [Issue Reporting Guidelines](#issue-reporting-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)

## Issue Reporting Guidelines

- When you are creating a bug report, please include as many details as possible. 

- Before creating issue reports, perform a cursory search to see if the problem has already been reported. If it has and the issue is still open, add a comment to the existing issue instead of opening a new one.

- If you find a Closed issue that seems like it is the same thing that you're experiencing, open a new issue and include a link to the original issue in the body of your new one.

- Open a new issue using the [Issue Template](https://github.com/ConduitPlatform/Conduit/blob/master/.github/ISSUE_TEMPLATE.md)

## Pull Request Guidelines

- Checkout a topic branch from `master`, and merge back.

- It's OK to have multiple small commits as you work on the PR - GitHub will automatically squash it before merging.

- If adding a new feature:
    - Add accompanying test case.
    - Provide a convincing reason to add this feature. Ideally, you should open a suggestion issue first and have it approved before working on it.

- If fixing bug:
    - If you are resolving a reported issue, add `(fix #xxx)` (#xxx is the issue id) in your PR title for a better release log, e.g. `update entities encoding/decoding (fix #389)`.
    - Provide a detailed description of the bug in the PR and the steps to reproduce it.

- **DO NOT** change `.gitignore`.

- Open a new pull request using the [Pull Request Template](https://github.com/ConduitPlatform/Conduit/blob/master/.github/PULL_REQUEST_TEMPLATE.md)

## Development Setup

You will need [Node.js](http://nodejs.org) **version 14+**, [yarn](https://yarnpkg.com/en/docs/install) and either [MongoDB](https://www.mongodb.com/) or [PostgreSQL](https://www.postgresql.org/).

After cloning the repo, run:

``` bash
yarn
npx lerna run build
REDIS_HOST=localhost REDIS_PORT=6379 yarn --cwd ./packages/core start
CONDUIT_SERVER=0.0.0.0:55152 SERVICE_IP=0.0.0.0:55165 yarn --cwd ./modules/database start
```

Then repeat the last step for every additional module you need to bring online:

``` bash
CONDUIT_SERVER=0.0.0.0:55152 SERVICE_IP=0.0.0.0:PORT yarn --cwd ./modules/MODULE start
```

### Committing Changes

Commit messages should follow the [commit message convention](https://github.com/ConduitPlatform/Conduit/blob/master/.github/COMMIT_CONVENTION.md) so that changelogs can be automatically generated.

### Commonly Used Commands

``` bash
# Building Everything
npx lerna run build

# Building Individual Modules (eg: Database)
npx lerna run build --scope=@conduit/database

# Running a module with env vars
CONDUIT_SERVER="0.0.0.0:55152" SERVICE_IP="0.0.0.0:55183" \
npx lerna run start --scope=@conduit/database
```

Find out more about [Lerna](https://lerna.js.org/).

You may find additional scripts in the `scripts` section of the `package.json` file.

## Project Structure

- **`packages`**: contains *core modules* built into the "Core" package
    - `admin`: handles admin routes (using *router*)
    - `commons`: SDK for *core module* intracommunication
    - `config`: handles configuration of Conduit modules
    - `core`: just the base entrypoint
    - `router`: handles user routes, REST, GraphQL, WebSockets
    - `security`: handles security clients, bot detection etc

- **`modules`**: contains *non-core modules*
    - `authentication`: provides user authentication
    - `chat`: chat room functionality
    - `cms`: custom schema, data and functional endpoint generation
    - `database`: database engine communication using adapters
    - `email`: email sending with templates support
    - `forms`: form generation and submission
    - `push-notifications`: provides support for push notifications
    - `sms`: provides support for SMS communication
    - `storage`: consistent storage

- **`libraries`**: contains shared libraries
    - `grpc-sdk`: SDK for gRPC communication used by both *core* and *non-core* modules

- **`scripts`**: contains build-related utility scripts

- **`docker`**: contains OCI-container related utilities

- **`benchmarks`**: contains benchmarking utilities
    
## Credits

Thank you to all the people who have already contributed to Conduit!

<a href="https://github.com/conduitplatform/conduit/graphs/contributors"><img src="https://contrib.rocks/image?repo=conduitplatform/conduit" /></a>
