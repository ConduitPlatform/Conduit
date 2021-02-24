---
name: Router route: /router menu: Core
---

# Router package

This module should provide a way to generate routes both for REST and GraphQL APIs, along with documentation.

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

## Usage

The router, as all module in conduit, communicates through the grpc sdk.

For every route that you declare you have the following parameters:

- input: ConduitRouteOptions,
- type: ConduitRouteReturnDefinition,
- handler: (request: ConduitRouteParameters) => Promise<any>

Let's break them down to see what they do

### Input

These options specify the parameters that Conduit should extract
from the requests of the clients. Each field represents a different
position in the request. It mainly effects REST requests, since GraphQL
only has one type of parameter.

- queryParams?: ConduitRouteOption;
- bodyParams?: ConduitModel; 
- urlParams?: ConduitRouteOption; 

Actions are GET, PUT, POST, DELETE. While these verbs are more obvious in REST,
on GraphQL they are used to distinct between queries(GET) and mutations(the rest). Also,
they are used to provide more descriptive naming when query names are not provided by the user
or if the endpoints are auto-generated like in the case of the CMS.

- action:ConduitRouteActions;

The path field is used for REST urls and for the auto-generated names of GraphQL.

- path: string; 
  
The name for the route is optional and only used in GraphQL currently. If you
do not wish for conduit to generate the GraphQL names then you can specify your name here.
- name?: string; 

Description isn't currently used, but will be added in Swagger and GraphQL to provide more info on the specific route
- description?: string; 
  
Middlewares specify each middleware that should be run before the actual handler that you provide.
The middlewares array should contain names of handlers that conduit knows about.
In the future this may also include external urls.
- middlewares?: string[];
