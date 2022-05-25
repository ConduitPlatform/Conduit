# Conduit SDK module

This module provides a framework to bind all conduit modules in a safe and consistent way.

It is also used to provide syntactic sugar, that make development easier.

## Build Steps

- run build.sh
- run npm build

## Features

- Service registration & Discovery
- Route registration
- Provides wrappers for grpc handlers to support async
- Parses incoming requests and outgoing responses to JSON
- Provides health check service out of the box
- Manages the grpc server so you don't have to
- Provides typings for common Conduit models
