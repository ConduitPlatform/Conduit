# Router Module — Features & Capabilities

> **Module path:** `modules/router/`  
> **Package:** `@conduitplatform/router`  
> **Runtime engine:** [`libraries/hermes`](../../libraries/hermes)  
> **Peer dependency:** [`database`](../database) (required; awaited at startup)

The Router module is Conduit's **Client API gateway**. It exposes the application-facing HTTP and WebSocket surface that end-user apps call at runtime (`CLIENT_HTTP_PORT`, default `3000`). Other Conduit modules register their client routes with the Router over gRPC; Hermes translates those registrations into REST, GraphQL, and Socket.io endpoints, runs the middleware pipeline, and forwards handler execution back to the originating module.

The Router module itself also registers **Admin API routes** (for route introspection, middleware patching, and security-client management) on the platform Admin API — distinct from the Client API gateway it hosts.

---

## Overview

### Role in the platform

| Concern | Router responsibility |
|--------|------------------------|
| Client API ingress | Single HTTP server (REST + GraphQL) and separate Socket.io server for realtime |
| Route aggregation | Collects route definitions from all modules via gRPC `RegisterConduitRoute` |
| Request dispatch | Proxies inbound HTTP/GraphQL/socket events to module gRPC handlers (`ClientRouter.Route` / `ClientRouter.SocketRoute`) |
| Cross-cutting security | Global rate limiting, CORS, Helmet, optional client validation, optional captcha |
| Middleware orchestration | Runs global + per-route middleware chains; supports runtime middleware patching |
| High availability | Persists route state and syncs across Router replicas via Redis bus + state store |
| Observability | Prometheus metrics for registered routes and security clients; HTTP request duration histogram |

### Supported transports (Client API)

| Transport | Default | Endpoint / path | Toggle |
|-----------|---------|-----------------|--------|
| REST | enabled | Module-prefixed paths (e.g. `/authentication/local`) | `transports.rest` |
| GraphQL | enabled | `/graphql` (Apollo Server) | `transports.graphql` |
| WebSockets | enabled | Socket.io at `/realtime`, per-module namespaces (e.g. `/chat/`) | `transports.sockets` |
| Swagger / OpenAPI | always when REST enabled | `/swagger`, `/swagger.json`, Scalar UI at `/reference` | — |
| MCP (Model Context Protocol) | **not enabled on Client Router** | — | Client Router does not call `initMCP()` |

> **Note:** MCP transport is implemented in Hermes and enabled on the **Admin API gateway** (`packages/core/src/admin/AdminModule.ts`), not on the Client Router module documented here.

### Architecture (simplified)

```
End-user app
    │
    ├─ HTTP :3000 ──► ConduitRoutingController (Hermes)
    │                    ├─ Global middleware (security, parsers, logging)
    │                    ├─ REST router ──► gRPC ──► Module ClientRouter.Route
    │                    └─ GraphQL router ──► gRPC ──► Module ClientRouter.Route
    │
    └─ WS :3001 ──► Socket.io (Redis Streams adapter)
                         └─ gRPC ──► Module ClientRouter.SocketRoute

Other modules ──gRPC RegisterConduitRoute──► Router module ──► Hermes route registry
```

### Core class

`ConduitDefaultRouter` (`src/Router.ts`) extends `ManagedModule<Config>` from `@conduitplatform/module-tools`. Lifecycle:

1. **`onServerStart`** — await database peer, register DB schemas, run migrations, construct `ConduitRoutingController`, register `conduitRequestMiddleware`.
2. **`onRegister`** — attach Admin handlers and `SecurityModule`.
3. **`preConfig`** — default `hostUrl` from `__DEFAULT_HOST_URL` or `http://localhost:{CLIENT_HTTP_PORT}`.
4. **`onConfig`** — enable/disable REST, GraphQL, sockets; setup security middlewares; register `/ready`; initialize HA recovery.

---

## Configuration

Configuration schema: `src/config/config.ts` (Convict). Patched at runtime via Admin API `patch_config_router`.

### Top-level settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `hostUrl` | string | `''` (resolved at startup) | Public base URL for Swagger server metadata |
| `captcha.enabled` | boolean | `false` | Enable captcha token verification middleware |
| `captcha.provider` | enum | `recaptcha` | `recaptcha` \| `hcaptcha` \| `turnstile` |
| `captcha.secretKey` | string | `''` | Provider secret key |
| `cors.enabled` | boolean | `true` | Enable CORS middleware |
| `cors.origin` | string | `*` | Origin or comma-separated list |
| `cors.methods` | string | `GET,HEAD,PUT,PATCH,POST,DELETE` | Allowed methods |
| `cors.allowedHeaders` | string | `Content-Type,Authorization,Cache-Control` | Allowed request headers |
| `cors.exposedHeaders` | string | `Content-Type,Authorization,Cache-Control` | Exposed response headers |
| `cors.credentials` | boolean | `true` | Allow credentials |
| `cors.maxAge` | number | `86400` | Preflight cache (seconds) |
| `transports.rest` | boolean | `true` | Enable REST |
| `transports.graphql` | boolean | `true` | Enable GraphQL |
| `transports.sockets` | boolean | `true` | Enable WebSockets |
| `security.clientValidation` | boolean | `false` | Require `clientId` / `clientSecret` headers |
| `rateLimit.maxRequests` | number | `50` | Global per-IP request cap per window |
| `rateLimit.resetInterval` | number | `1` | Window length in **seconds** |

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CONDUIT_SERVER` | yes | — | Conduit Core address (`host:port`) |
| `SERVICE_URL` | no | module default | This module's listen address (use LB address if behind load balancer) |
| `GRPC_PORT` | no | `55190` | gRPC server port |
| `GRPC_KEY` | no | — | Shared secret for signed gRPC requests across modules |
| `CLIENT_HTTP_PORT` | no | `3000` | Client REST + GraphQL port |
| `CLIENT_SOCKET_PORT` | no | `3001` | Client WebSocket port |
| `__DEFAULT_HOST_URL` | no | — | Override for initial `hostUrl` |

Docker exposes ports `5000` (gRPC), `3000` (HTTP), `3001` (WebSocket).

### Database schemas owned by Router

| Schema | Collection purpose |
|--------|-------------------|
| `Client` | Security clients (clientId, hashed clientSecret, platform, domain, alias, notes) |
| `AppMiddleware` | Persisted per-route middleware injections (path, action, middleware name, position, owner module URL) |

Both schemas use `canCreate: false`, `canModify: 'ExtensionOnly'`, `canDelete: false` at the Conduit permissions layer — managed exclusively through Router admin routes.

---

## Client API Gateway

### HTTP server (`CLIENT_HTTP_PORT`)

Hermes `ConduitRoutingController` creates a single Express app with:

- **Request routing fork:** paths starting with `/graphql` → GraphQL controller; `/mcp` → MCP (disabled on Client Router); everything else → REST controller.
- **Body limits:** JSON and urlencoded parsers at **50 MB**.
- **Cookies:** `cookie-parser` enabled.
- **Static files:** serves `hermes/public`.
- **Error handler:** returns `ConduitError.status` and message as plain text for unhandled errors at the outer layer.

### REST

- Maps `ConduitRouteActions` to Express verbs: `GET`, `POST`, `PUT` (`UPDATE`), `PATCH`, `DELETE`.
- **Parameter extraction:** query, body, and URL params validated via Zod (`ZodParser`) before handler execution.
- **`strictParams` behavior:**
  - `true` — reject unknown keys (`USER_INPUT_ERROR`)
  - `false` — passthrough unknown keys to handler
  - unset — strip unknown keys (default)
- **Response handling:** JSON by default; supports redirects, `setCookies` / `removeCookies` from gRPC response, gRPC error → HTTP status mapping.
- **Module path prefixing:** routes auto-prefixed with `/{moduleName}` unless already prefixed or under `/hook/{moduleName}/`. Exception: `communications` module keeps legacy unprefixed paths.
- **Hook routes:** `/hook` paths rewritten to `/hook/{moduleName}/...`.

### GraphQL

- Auto-generates Query (GET actions) and Mutation (non-GET actions) from registered routes.
- Uses Apollo Server with cookie plugin.
- Route `name` overrides auto-generated operation names.
- Route `description` and `errors[]` appear in GraphQL schema comments.
- Supports `populate` query param splitting and relation population via `graphql-parse-resolve-info`.
- GET-request caching mirrors REST cache semantics.

### WebSockets (Socket.io)

- Separate HTTP server on `CLIENT_SOCKET_PORT`, sharing the Express app instance.
- Socket.io path: `/realtime`.
- **Redis Streams adapter** for multi-instance fan-out.
- **Connection state recovery:** 2-minute max disconnection window; skips middleware on successful recovery.
- Per-module **namespaces** (e.g. `/chat/` from `socketPush` namespace `/{module-name}/`).
- Lifecycle events: `connect`, `disconnect`, custom events via `onAny`.
- Handler responses can: emit events, join/leave rooms, target receivers by user ID (`socket.data.user._id`).
- Global HTTP middlewares marked `socketMiddleware: true` also run on the Socket.io engine layer.

### Built-in Client routes

| Path | Action | Handler | Purpose |
|------|--------|---------|---------|
| `/ready` | GET | Returns `"Conduit is online!"` | Liveness/readiness probe (exempt from client validation) |

Registered automatically in `onConfig` if not already present.

### API documentation

When REST is enabled, Hermes exposes:

| Path | UI |
|------|-----|
| `/swagger` | Swagger UI |
| `/swagger.json` | Raw OpenAPI JSON |
| `/reference` | Scalar API Reference |

Swagger metadata (`src/hermes/swaggerMetadata.ts`) injects:

- Server URL from `hostUrl`
- Security schemes: `clientId` + `clientSecret` (when client validation enabled), `userToken` (Bearer)
- Per-route security annotations when route uses `authMiddleware` (required) or `authMiddleware?` (optional)

In **production**, GraphQL explorer and Swagger/Reference GET requests return **401** when client validation middleware runs (unless client validation is disabled).

### Response caching (GET only)

Routes may set `cacheControl: "public,max-age=N"` or `"private,max-age=N"`.

- Cache evaluated **after middleware execution**.
- Stored in Redis state (`hash-{md5}` keys) via `grpcSdk.state`.
- Respects client `Cache-Control: no-cache` header.
- Sets response `Cache-Control` header on cache hits and stores.

---

## Admin API Gateway

Router admin routes are registered via `AdminHandlers` on the **platform Admin API** (Core admin server, not the Client HTTP port). They use `RoutingManager` with the Admin gRPC router.

### Route management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/router/middlewares` | List all registered middleware handler names across modules. Query: `sortByName` (boolean). |
| GET | `/router/route-middlewares` | Get middleware chain for a route. Query: `path`, `action` (required). |
| PATCH | `/router/patch-middleware` | Replace middleware chain for a route. Query: `path`, `action`; body: `{ middlewares: string[] }`. |
| GET | `/routes` | Full route catalog grouped by module (REST routes, socket routes, middlewares). |

`GET /routes` response shape per module:

```json
{
  "<moduleName>": {
    "moduleUrl": "<grpc-url>",
    "routes": { "<grpcFunction>": { "action", "path", "description", "middlewares", "handler" } },
    "socketRoutes": { "<namespace>": { "<event>": { ... } } },
    "middlewares": { "<middlewareName>": { ... } }
  }
}
```

### Security client management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/security/client` | Create client. Body: `platform` (required), `domain`, `alias`, `notes`. Returns plaintext `clientSecret` once. |
| GET | `/security/client` | List all security clients (secrets excluded). |
| UPDATE | `/security/client/:id` | Update `domain`, `alias`, `notes`. |
| DELETE | `/security/client/:id` | Delete client. |

**Supported platforms** (`PlatformTypesEnum`): `WEB`, `ANDROID`, `IOS`, `IPADOS`, `WINDOWS`, `MACOS`, `LINUX`, `CLI`.

**WEB platform rules:**

- `domain` required on create/update.
- Supports exact domain match or single `*` wildcard prefix (e.g. `*.example.com`).
- Validation uses origin header (`req.get('origin')`) or hostname.

**Non-WEB platforms:** validate `clientSecret` header against bcrypt hash.

---

## Middleware Pipeline

### Execution order (HTTP)

1. **Hermes instrumentation** — `http_request_duration_seconds` histogram (method, route, status).
2. **Hermes global middlewares** (registered in `ConduitRoutingController.registerGlobalMiddleware`):
   - Winston request logging
   - `express.json` (50 MB)
   - `express.urlencoded` (50 MB)
   - `cookie-parser`
   - Static file serving
3. **Router global middlewares** (registered in `SecurityModule.setupMiddlewares`, once):
   - `rateLimiter` — global IP rate limit (Redis)
   - `corsMiddleware` — configurable CORS (also applied to sockets)
   - `helmetMiddleware` — Helmet security headers
   - `helmetGqlFix` — removes CSP/COEP on GET `/graphql`, `/swagger`, `/reference`
   - `clientMiddleware` — client validation (also on sockets)
   - `captchaMiddleware` — captcha verification (HTTP only, not sockets)
4. **`conduitRequestMiddleware`** — initializes `req.conduit = {}` (registered at startup, always first among Router-owned globals).
5. **Per-route middleware chain** — executed in `preHandle()` before gRPC handler dispatch.
6. **Per-route rate limit** — if `route.rateLimit` configured, checked in `preHandle()` before named middlewares.
7. **Route handler** — gRPC call to originating module.

### Optional middleware

Middleware names suffixed with `?` (e.g. `authMiddleware?`) are **optional**: failures are swallowed and the chain continues. Without `?`, middleware failure aborts the request.

### Middleware context

- Middleware gRPC handlers return JSON merged into `params.context`.
- Client validation sets `req.conduit.clientId`.
- Captcha sets `req.conduit.captcha` to `disabled` | `missing` | `failed` | `success`.

### Stored middleware (persistence)

Admin or programmatic patches persist injected middleware in `AppMiddleware` collection. On startup / route registration:

1. `scheduleMiddlewareApply()` debounces 3 seconds.
2. `applyStoredMiddleware()` reads DB records and re-injects middleware at stored positions.
3. Tracks `hasAppliedMiddleware` per module URL to avoid duplicate application.

### Middleware ownership & removal rules

When patching middleware:

- **Injected** middleware must already be registered (module exported it via route registration).
- **Removed** middleware can only be removed by the **owning module** (matched by module gRPC URL). Cross-module removal returns `PERMISSION_DENIED`.

### Module-registered middleware

Modules register middleware by declaring a route with `returns: null` and a `grpcFunction` name. These appear in `GET /router/middlewares` and can be attached to other routes via patch.

Common middleware names from other modules (not part of Router, but attachable):

- `authMiddleware`, `authMiddleware?` — authentication module
- `checkAnonymousMiddleware` — authentication module
- Module-specific validators

---

## Rate Limiting & Security

### Global rate limiting

- **Scope:** per client IP.
- **Store:** Redis key `limiter:{ip}`.
- **Config:** `rateLimit.maxRequests` / `rateLimit.resetInterval` (seconds).
- **IP extraction** (`extractClientIp`): `cf-connecting-ip` → `x-forwarded-for` (first hop) → `x-real-ip` → `x-original-forwarded-for` → Express `req.ip`.
- **OPTIONS** requests bypass counting.
- **Failure mode:** logs Redis errors but allows request through (does not fail closed).

### Per-route rate limiting

- Configured on individual routes via `rateLimit: { maxRequests, resetInterval }`.
- Redis key: `limiter:route:{action}:{path}:{ip}`.
- **Failure mode:** **fail closed** — returns 429 `Rate limit check unavailable` if Redis is down.

### Client validation

When `security.clientValidation` is `true`:

| Header | Required | Notes |
|--------|----------|-------|
| `clientId` | yes | Lookup in `Client` collection |
| `clientSecret` | yes (non-WEB) | Bcrypt compare; stripped after validation |

**Exemptions:** paths starting with `/hook`, `/`, `/ready`; GraphQL/Swagger/Reference GET in non-production.

**Caching:** validated clients cached in Redis state (`clientId` → `secret,platform,domain`) with ~100s TTL for revocation without Redis restart.

When disabled: sets `req.conduit.clientId = 'anonymous-client'`, strips client headers.

### Captcha

When `captcha.enabled`:

- Reads `req.body.captchaToken`.
- Verifies against configured provider API.
- Sets `req.conduit.captcha` status but **does not block the request** on missing/failed captcha — downstream handlers decide enforcement.

### Helmet & CORS

- Helmet applied globally; CSP/COEP relaxed for documentation UIs.
- CORS configurable; supports comma-separated origins.

### gRPC transport security

- Inter-module gRPC calls include `grpc-token` metadata when `GRPC_KEY` is configured.
- ClientRouter gRPC client uses round-robin load balancing, DNS re-resolution every 5s, 10s keepalive.

---

## Route Registration

### gRPC API (Router service)

Defined in `src/router.proto`:

```protobuf
service Router {
  rpc RegisterConduitRoute (RegisterConduitRouteRequest) returns (google.protobuf.Empty);
  rpc SocketPush (SocketData) returns (google.protobuf.Empty);
  rpc PatchRouteMiddlewares(PatchAppRouteMiddlewaresRequest) returns (google.protobuf.Empty);
}
```

### From module code (grpc-sdk)

```typescript
import { Router } from '@conduitplatform/grpc-sdk';

await grpcSdk.router.register(routeDefinitions, moduleUrl?);
await grpcSdk.router.socketPush({ event, data, receivers, rooms });
await grpcSdk.router.patchRouteMiddlewares(path, action, middlewares);
```

Modules typically use `RoutingManager` from `@conduitplatform/module-tools`:

- `.route(input, returnType, handler)` — REST/GraphQL route
- `.middleware(input, handler)` — named middleware
- `.socket(input, events)` — WebSocket namespace + events
- `.registerRoutes()` — flush to Router gRPC

### Route definition fields (`ConduitRouteOptions`)

| Field | Purpose |
|-------|---------|
| `action` | `GET` \| `POST` \| `PUT` \| `PATCH` \| `DELETE` |
| `path` | REST path; also drives GraphQL operation naming |
| `name` | Optional GraphQL operation name override |
| `description` | Swagger / GraphQL documentation |
| `queryParams` | Query parameter schema |
| `bodyParams` | Body schema (`ConduitModel`) |
| `urlParams` | URL parameter schema |
| `middlewares` | Ordered middleware names |
| `cacheControl` | `"public,max-age=N"` or `"private,max-age=N"` |
| `errors` | Documented error codes (GraphQL descriptions) |
| `mcp` | Exclude route from MCP tool generation when `false` (Admin MCP only) |
| `strictParams` | Unknown key handling (see REST section) |
| `rateLimit` | Per-route `{ maxRequests, resetInterval }` |

### Socket route definition

Socket routes use `events` JSON (stringified map of event name → `{ grpcFunction, params, returns }`) instead of `returns`/`grpcFunction` at the top level.

### Registration flow

1. Module calls `RegisterConduitRoute` with route array + optional `routerUrl`.
2. Router resolves `routerUrl` from module config if omitted.
3. `grpcToConduitRoute()` builds `ConduitRoute`, `ConduitMiddleware`, or `ConduitSocket` instances with gRPC client stubs pointing at the module.
4. `ConduitRoutingController.registerRoutes()` updates REST/GraphQL/Socket registries.
5. `updateState()` persists to shared state; `publishRouteData()` broadcasts on `router` bus channel for peer Router instances.
6. `cleanupRoutes()` removes stale routes no longer reported by any module.
7. Route refresh debounced 3 seconds (Hermes) / 1 second cleanup debounce on controller construction.

### High availability

- **State recovery:** on first config, reads persisted routes from `grpcSdk.state` and re-registers.
- **Bus subscription:** channel `router`, consumer group `router-ha` — applies route updates from peers.
- **Middleware re-application:** stored DB middleware re-applied after route recovery.

### Socket push (server-initiated)

`SocketPush` gRPC from any module:

| Field | Purpose |
|-------|---------|
| `event` | Event name; special: `join-room`, `leave-room` |
| `data` | JSON string payload |
| `receivers` | Target user IDs (matched against `socket.data.user._id`) |
| `rooms` | Socket.io room names |
| Namespace | Derived from caller module: `/{module-name}/` |

Supports: broadcast to namespace, room emit, targeted socket emit, bulk join/leave room.

---

## gRPC Services

### Router module service (`router.Router`)

| RPC | Caller | Behavior |
|-----|--------|----------|
| `RegisterConduitRoute` | Any module via grpc-sdk | Register/update client routes |
| `SocketPush` | Any module | Push realtime events to connected clients |
| `PatchRouteMiddlewares` | Any module | Update middleware chain for a route |

Metadata: `module-name` header identifies registering module.

### Module-side handler service (`conduit.module.v1.ClientRouter`)

Each module exposes:

| RPC | Purpose |
|-----|---------|
| `Route` | Execute REST/GraphQL route handler |
| `SocketRoute` | Execute WebSocket event handler |

Request carries serialized params, headers, context, cookies, and `functionName`. Response supports `result`, `redirect`, `setCookies`, `removeCookies`.

### Admin-side equivalent

Admin routes on modules use `AdminRouter` (same proto shape, different descriptor in `grpcToConduitRoute`).

---

## Integration Points

### Required dependencies

| System | Usage |
|--------|-------|
| **Database module** | Peer dependency; stores `Client` and `AppMiddleware` schemas |
| **Redis** | Global/per-route rate limits, socket.io adapter, state cache, client validation cache, GET response cache |
| **Conduit Core** | Module registration, config, health, bus, state |

### Libraries

| Package | Role |
|---------|------|
| `@conduitplatform/hermes` | REST, GraphQL, Socket.io, caching, gRPC route conversion, Swagger |
| `@conduitplatform/grpc-sdk` | Types, Router client, error types |
| `@conduitplatform/module-tools` | `ManagedModule`, `ConfigController`, `RoutingManager`, `ConduitActiveSchema` |

### Metrics (Prometheus)

| Metric | Type | Labels | Source |
|--------|------|--------|--------|
| `client_routes_total` | Gauge | `transport` (`rest`, `graphql`, `socket`) | Hermes route registration |
| `security_clients_total` | Gauge | `platform` | Router `initializeMetrics()` + create/delete client |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `code` | Hermes instrumentation middleware |

### Event bus channels

| Channel | Payload | Purpose |
|---------|---------|---------|
| `router` | `{ routes, url }` | HA route sync across Router replicas |

### Config hot-reload

`onConfig()` re-evaluates transport toggles and security middleware setup when Router config changes via Admin API.

---

## Feature Matrix

| Capability | REST | GraphQL | WebSocket | Notes |
|------------|:----:|:-------:|:---------:|-------|
| Route registration via gRPC | ✓ | ✓ | ✓ | Shared registration call |
| Per-route middleware | ✓ | ✓ | ✓ | Optional `?` suffix |
| Per-route rate limit | ✓ | ✓ | — | IP-based, fail closed |
| Global rate limit | ✓ | ✓ | ✓ | IP-based, via engine middleware for WS |
| Response caching (GET) | ✓ | ✓ | — | Redis-backed |
| Parameter validation (Zod) | ✓ | ✓ | — | strict/strip/passthrough |
| Client validation | ✓ | ✓ | ✓ | Configurable |
| Captcha middleware | ✓ | — | — | Non-blocking |
| CORS | ✓ | ✓ | ✓ | |
| Helmet | ✓ | ✓ | — | |
| Cookie set/remove in response | ✓ | ✓ | — | Via gRPC response |
| Redirect responses | ✓ | — | — | |
| Swagger / OpenAPI docs | ✓ | — | — | Auto-generated from routes |
| gRPC error → HTTP mapping | ✓ | ✓ | — | |
| Module path prefix | ✓ | ✓ | ✓ | Except `communications` |
| MCP tool exposure | — | — | — | Admin gateway only |
| Socket push / rooms | — | — | ✓ | Via `SocketPush` RPC |
| Connection state recovery | — | — | ✓ | 2-minute window |
| Multi-instance socket fan-out | — | — | ✓ | Redis Streams adapter |
| Stored middleware persistence | ✓ | ✓ | ✓ | `AppMiddleware` collection |
| HA route recovery | ✓ | ✓ | ✓ | State + bus |
| `/ready` health endpoint | ✓ | — | — | |

---

## Open Questions

1. **MCP on Client API** — Hermes supports MCP at `/mcp`, but Client Router never calls `initMCP()`. Only the Admin gateway exposes MCP. Should Client routes with `mcp: true` ever surface on the Client port?

2. **Captcha middleware is non-blocking** — Missing or invalid captcha sets `req.conduit.captcha` but always calls `next()`. Which modules enforce captcha, and should Router block by default when enabled?

3. **Global rate limit fail-open vs per-route fail-closed** — Intentional asymmetry? Global limiter logs Redis errors and allows traffic; per-route limiter rejects with 429.

4. **Empty migrations** — `src/migrations/index.ts` is a no-op stub. Are schema migrations handled entirely by the database module's `migrate()` call?

5. **Unused builders** — `src/builders/RouterBuilder.ts` and `RouteBuilder.ts` appear incomplete (e.g. `construct()` wires all verbs to `.get()`). Are these deprecated or WIP?

6. **`registerGrpcRoute` error handling** — Comment notes missing error handler; empty success response even on partial failures.

7. **GraphQL + REST simultaneous disable** — Client Router allows both off (Admin module prevents this for Admin API). Is a Router with only sockets intended?

8. **Rate limit `resetInterval` units** — Config doc says seconds; confirm operational expectations vs. typical req/minute configurations in authentication module presets.

9. **Security client delete metric** — `decrement('security_clients_total')` on delete does not pass `platform` label; may skew labeled metric series.

10. **Production Swagger access** — Blocked via unauthorized error in client middleware when `env === 'production'`. Is this sufficient or should transports expose a config toggle?

---

## Related files (quick reference)

| Area | Path |
|------|------|
| Main module class | `modules/router/src/Router.ts` |
| Config schema | `modules/router/src/config/config.ts` |
| gRPC proto | `modules/router/src/router.proto` |
| Security | `modules/router/src/security/` |
| Admin routes | `modules/router/src/admin/` |
| Hermes engine | `libraries/hermes/src/` |
| grpc-sdk Router client | `libraries/grpc-sdk/src/modules/router/` |
| Route types | `libraries/grpc-sdk/src/interfaces/Route.ts` |
| Module route registration | `libraries/module-tools/src/routing/RoutingManager.ts` |
