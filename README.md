[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-Ready--to--Code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/Quintessential-SFT/conduit) 
[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
# Conduit Platform
Conduit is a NodeJS Based API platform/Gateway, that aims to cut down backend development times

## Running
- npm install
- lerna bootstrap 

## Info
- Server runs at: http://localhost:3000
- Metrics dashboard available at: http://localhost:3000/appmetrics-dash

## TODO
- Create the modules (duh)
- Data persistence for config data
- Cluster mode support to run multiple instances
- Messaging system to communicate with micro-services and other instances
- Event bus system to handle inter-module communications
- Add the ability to add conduit as a middleware. 
- Ability to split config schema per module for easier maintenance
