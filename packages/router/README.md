---
name: Router
route: /router
menu: Core
---

# Router package

This module should provide a way to generate routes both for REST and GraphQL APIs,
along with documentation.

## Features [WIP]

- Generate REST endpoints
- Generate GraphQL endpoints
- Generate documentation for REST with OpenAPI & Swagger
- Generate documentation for GraphQL with the built in "description" functionality

### TODO

- Find a way to generate routes as files (if that makes sense)
  - Before doing that the structure and features should be finalized
- Add validations for requests based on the supplied parameters
- Generate the swagger .json file so that route documentation is available
- Add GraphQL support
