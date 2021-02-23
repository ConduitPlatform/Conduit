[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
![.github/workflows/development.yml](https://github.com/Quintessential-SFT/conduit/workflows/.github/workflows/development.yml/badge.svg?branch=master)

# Conduit Platform

Conduit is a NodeJS Based Application Platform, that aims to cut down backend development times
by providing ready-made modules that offer common functionality out of the box.

## Running

- yarn
- npx lerna run build

## Info

- HTTP Server runs at: http://localhost:3000
- Grpc Server runs at: localhost:55152

## DONE

- Create the modules
- Ability to split config schema per module for easier maintenance
- Data persistence for config data
- Cluster mode support to run multiple instances
- Event bus system to handle inter-module communications

## TODO

- Messaging system to communicate with micro-services and other instances
