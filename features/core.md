# Core Platform

## Overview

**Conduit Core** (`@conduitplatform/core`, `packages/core/`) is the platform control plane. It is the single entry point that:

- Exposes the **Admin API** (REST, GraphQL, WebSockets, MCP) for operators and tooling
- Owns **module configuration** (read/write, persistence, reconciliation)
- Runs **service discovery** (registration, health monitoring, recovery)
- Hosts **admin identity** (users, JWT sessions, API tokens, 2FA)
- Provides **gRPC services** (`conduit.core.Config`, `conduit.core.Admin`) that all other modules connect to

Core does **not** implement domain features (auth, database, storage, etc.). Those live in separate `modules/*` microservices. Core orchestrates them.

### Bootstrap

| Step | Component | Behavior |
|------|-----------|----------|
| 1 | `src/bin/www.ts` | Reads `GRPC_PORT` (default **55152**), calls `Core.getInstance(grpcPort)` |
| 2 | `GrpcServer` | Creates gRPC server, initializes internal `ConduitGrpcSdk` pointing at itself |
| 3 | `ConfigManager` | Registers `conduit.core.Config` gRPC service, starts service-discovery monitors |
| 4 | `AdminModule` | Registers `conduit.core.Admin` gRPC service, wires Hermes routing controller |
| 5 | Wait for `database` | Migrates core schemas, seeds default admin, recovers HA state |

### Runtime dependencies

| Dependency | Purpose |
|------------|---------|
| **Redis** | Event bus (`bus_*`), distributed state (`state` key, `moduleConfigs.*`), config versioning, HA sync |
| **Database module** | Persists `Admin`, `AdminApiToken`, `Config`, `AdminMiddleware`, `AdminTwoFactorSecret` schemas |
| **Node.js 24+** | Engine requirement (`package.json`) |

### Related libraries (platform-level, not in `packages/core/`)

| Package | Path | Role relative to Core |
|---------|------|------------------------|
| `@conduitplatform/grpc-sdk` | `libraries/grpc-sdk/` | Client SDK all modules use to talk to Core (Config, Admin, health, bus, state) |
| `@conduitplatform/hermes` | `libraries/hermes/` | HTTP/GraphQL/Socket/MCP routing stack used by `AdminModule` |
| `@conduitplatform/module-tools` | `libraries/module-tools/` | `ManagedModule` base class, `GrpcServer`, `ConfigController`, metrics, routing helpers |

---

## Configuration

Configuration is **namespaced per module** (`core`, `admin`, plus each registered module). Storage uses a **Redis-primary, DB-reconciled** model.

### Core module config (`core`)

Schema: `packages/core/src/config/config.ts`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `env` | `production` \| `development` \| `test` | `development` | Environment label; `development` unlocks unauthenticated Swagger/GraphQL introspection |

Updated via `Core.setConfig()` → validates with convict → publishes `core:config:update` on the bus.

### Admin module config (`admin`)

Schema: `packages/core/src/admin/config/config.ts`

| Section | Fields | Notes |
|---------|--------|-------|
| **auth** | `tokenSecret`, `hashRounds` (11), `tokenExpirationTime` (72000 s) | `tokenSecret` auto-generated on first configure if empty |
| **cors** | `enabled`, `origin`, `methods`, `allowedHeaders`, `exposedHeaders`, `credentials`, `maxAge` | Applied as Express middleware when `enabled` |
| **hostUrl** | string | Public Admin API URL for Swagger; defaults to `http://localhost:{ADMIN_HTTP_PORT}` |
| **transports** | `rest`, `graphql`, `sockets`, `proxy`, `mcp` | REST+GraphQL cannot both be disabled (falls back to REST). MCP defaults **on**. |
| **mcp** | `pingInterval` (30s), `sessionTimeout` (5 min) | SSE/session tuning for MCP transport |

### Config registration flow (modules → Core)

1. Module calls `grpcSdk.config.configure(config, schema, override)` (gRPC `Config.Configure`).
2. `ConfigManager.configureModule()` parses schema, merges with existing config (unless `override`), persists, registers Admin REST routes for that module, updates Redis state (`modules[].configSchema`).
3. Per-module Admin routes are created dynamically:
   - `GET /config/{moduleName}`
   - `PATCH /config/{moduleName}`

### Config persistence (`ConfigStorage`)

| Mechanism | Detail |
|-----------|--------|
| Redis keys | `moduleConfigs.{name}` (JSON), `moduleConfigs.{name}:version` |
| DB model | `Config` — `{ name, config, version }` |
| Reconciliation | Periodic (~1.5–1.8s) flush of Redis → DB when DB is available; bus signals `reconciling` / `reconcile-done` |
| First sync | On DB availability: if DB empty, flush Redis configs to DB; else merge by version (DB wins when newer or Redis version not explicit) |
| DB preference | `applyDbConfigPreference()` prefers DB when `dbVersion > redisMeta.version` or Redis version was never explicitly set |
| Module notify | After sync, publishes `{moduleName}:config:update` for registered modules (except `core`/`admin`) |

### Environment variables (Core)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | Yes* | — | Redis host (*or use `REDIS_CONFIG` JSON via grpc-sdk) |
| `REDIS_PORT` | Yes* | — | Redis port |
| `REDIS_DB` | No | `0` | Redis DB index |
| `REDIS_USERNAME` / `REDIS_PASSWORD` | No | — | Redis auth |
| `REDIS_CONFIG` | No | — | Full Redis standalone/cluster JSON (overrides host/port) |
| `ADMIN_HTTP_PORT` | No | `3030` | Admin REST + GraphQL port |
| `ADMIN_SOCKET_PORT` | No | `3031` | Admin WebSocket port |
| `GRPC_PORT` | No | `55152` (`www.ts`) | Core gRPC listen port |
| `MASTER_KEY` | No | `M4ST3RK3Y` | Admin API master key header (`masterkey`) |
| `GRPC_KEY` | No | — | Enables signed gRPC JWT on internal calls |
| `METRICS_PORT` | No | — | When set, exposes Prometheus `/metrics` |
| `SERVICE_MONITOR_INTERVAL_MS` | No | `30000` | Service discovery poll interval |
| `SERVICE_RECONN_RETRIES` | No | `5` | Revive attempts before giving up |
| `SERVICE_RECONN_INIT_MS` | No | `250` | Linear backoff initial delay |
| `DEBUG__DISABLE_SERVICE_REMOVAL` | No | — | `true` disables unresponsive module deregistration |
| `__DEFAULT_HOST_URL` | No | — | Override computed `admin.hostUrl` |

Modules use `CONDUIT_SERVER` (Core gRPC URL) and their own `GRPC_PORT` / `SERVICE_URL`.

---

## Admin API Routes (core-owned)

All routes are registered on the Admin Hermes controller (`AdminModule`). Module-registered routes are **not** listed here but are proxied to module gRPC handlers.

**Authentication layers** (in order):

1. **Admin middleware** — `masterkey` header must match `MASTER_KEY` (unless route excluded or Bearer `cdt_*` API token)
2. **Auth middleware** — `Authorization: Bearer <JWT>` from `/login` or `cdt_*` API token

**Unauthenticated routes:** `/ready`, `/login`, `/config/modules` (still requires masterkey except in dev for docs), plus dev-only GET `/graphql`, `/swagger`, `/reference`.

### Health & readiness

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/ready` | None (masterkey bypass) | Liveness: returns `"Conduit Core is online!"` |

### Authentication & admins

| Method | Path | MCP | Description |
|--------|------|-----|-------------|
| POST | `/login` | No | Username/password → JWT (or short-lived `twoFaRequired` token if 2FA enabled) |
| POST | `/admins` | No | Create admin (superAdmin only) |
| GET | `/admins` | Yes | List admins (`skip`, `limit`, `sort`) |
| GET | `/admins/:id` | Yes | Get admin; `id=me` returns caller |
| DELETE | `/admins/:id` | No | Delete admin (superAdmin, not self) |
| PUT | `/change-password` | No | Change own password |
| PUT | `/admins/:adminId/change-password` | No | SuperAdmin resets another admin's password |

### Two-factor authentication

| Method | Path | MCP | Description |
|--------|------|-----|-------------|
| PUT | `/toggle-twofa` | No | Enable → returns QR string; disable → clears secret |
| POST | `/verify-qr-code` | No | Confirm TOTP during 2FA setup |
| POST | `/verify-twofa` | No | Complete login after `twoFaRequired` JWT |

### API tokens

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api-tokens` | Create token; body `{ name, expiresInDays? }`; returns plaintext `cdt_*` **once** |
| GET | `/api-tokens` | List caller's tokens (metadata only) |
| DELETE | `/api-tokens/:id` | Revoke own token |

Tokens are bcrypt-hashed in DB; prefix `cdt_` + first 12 chars stored for lookup.

### Configuration

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config` | Monolithic config for `core`, `admin`, and all registered modules |
| GET | `/config/modules` | Service registry list (`moduleName`, `url`, `serving`); query `sortByName` |
| GET | `/config/{moduleName}` | Per-module config (dynamic route per registered module) |
| PATCH | `/config/{moduleName}` | Patch module config; forwards to module gRPC `setConfig` for non-core/admin |
| POST | `/config/import` | Bulk import `{ config: { modules: { ... } } }`; core import explicitly rejected |
| GET | `/state/export` | Export all configs + exportable module resources (GitOps) |
| POST | `/state/import` | Import configs then module resources (priority-ordered) |

### Route middleware management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/route-middlewares` | Query `path`, `action` → middleware list for a registered module admin route |
| PATCH | `/patch-middleware` | Query `path`, `action`; body `{ middlewares: string[] }`; persists to `AdminMiddleware` |

Middleware patches survive restarts (applied ~3s after DB ready, per module URL).

### MCP (Hermes-hosted, core-enabled)

| Endpoint | Description |
|----------|-------------|
| `POST /mcp` | MCP Streamable HTTP (protocol `2025-06-18`) |
| `GET /mcp` | SSE stream half of Streamable HTTP |
| `GET /mcp/health` | MCP server health JSON (tools, modules, resources, uptime) |
| `OPTIONS /mcp` | CORS preflight |

Module tool loading: `?modules=authentication,database,...` on MCP URL. Alias: `communications` → `email`, `push`, `sms`.

Meta-tool always enabled: `list_modules`.

Routes with `mcp: false` are excluded from MCP (login, create admin, password/2FA routes).

### Transports (non-REST)

| Transport | Config flag | Default | Notes |
|-----------|-------------|---------|-------|
| REST + Swagger | `transports.rest` | on | `/swagger`, `/reference` (Scalar) in development |
| GraphQL | `transports.graphql` | off | Admin GraphQL over same HTTP port |
| WebSockets | `transports.sockets` | off | Socket.io on `ADMIN_SOCKET_PORT` |
| MCP | `transports.mcp` | on | See above |

---

## Service Discovery

Implemented in `packages/core/src/service-discovery/`.

### Architecture

```
Module startup
    → grpcSdk.config.registerModule(name, url, healthStatus)
    → Config.RegisterModule (gRPC)
    → ServiceRegistry.updateModule()
    → Redis state.modules[] updated
    → bus publish config { type: serving-modules-update }

ServiceMonitor (interval)
    → gRPC health check per registered module
    → update serving flag / deregister on failure
    → bus publish + serving-modules-update event
    → WatchModules streams get updates
```

### ServiceRegistry

In-memory `Map<moduleName, { address, serving }>`. Source of truth for Admin `GET /config/modules` and `Config.GetModuleUrlByName`.

### ServiceMonitor

| Behavior | Detail |
|----------|--------|
| Interval | `SERVICE_MONITOR_INTERVAL_MS` (default 30s) |
| Health check | gRPC `grpc.health.v1.Health/Check`; modules **without** health service assumed healthy |
| Failure handling | 3 consecutive check throws → treat as `SERVICE_UNKNOWN` → remove from registry → `reviveService()` with linear backoff |
| Push updates | Modules call `Config.ModuleHealthProbe` on status changes |
| Debug | `DEBUG__DISABLE_SERVICE_REMOVAL=true` skips periodic removal |

### gRPC API (`conduit.core.Config`)

| RPC | Purpose |
|-----|---------|
| `RegisterModule` | Register/update module URL + initial health |
| `ModuleExists` | Lookup URL by name |
| `ModuleList` | Snapshot of all modules |
| `WatchModules` | Server-streaming updates on registry changes |
| `ModuleHealthProbe` | Push health status from module |
| `GetModuleUrlByName` | Resolve gRPC/router URL |
| `Get` | Get module config JSON by key |
| `Configure` | Register module config + schema |
| `GetServerConfig` | Core `hostUrl` + `env` |
| `GetRedisDetails` | Redis connection info for modules |

### High availability

| State key | Content |
|-----------|---------|
| Redis `state` | `{ modules: [{name, url, configSchema?}], routes: [...] }` |
| Bus `config` | `module-health`, `serving-modules-update`, reconcile signals |
| Bus `admin` | Admin route registration broadcasts |
| Bus `admin:config:update` | Admin config hot-reload |
| Bus `core:config:update` | Core config hot-reload |
| Bus `{module}:config:update` | Per-module config push after DB sync |

On Core restart: recovers modules from state, re-registers routes only if module `isModuleUp`, reapplies stored middleware from DB.

### Limitations (documented in code)

- **No per-instance load balancing** — one URL per module name
- Unresponsive services removed quickly; reconnection uses linear backoff

---

## API Tokens & Admins

### Data models

| Model | Fields / behavior |
|-------|-------------------|
| **Admin** | `username`, `password` (bcrypt, select:false), `hasTwoFA`, `isSuperAdmin`, timestamps |
| **AdminApiToken** | `name`, `adminId`, `hashedToken`, `tokenPrefix`, `expiresAt?`, `lastUsedAt?` |
| **AdminTwoFactorSecret** | `adminId`, `secret`, `uri`, `qr` (pending setup) |
| **AdminMiddleware** | `path`, `action`, `middleware`, `position`, `owner` (module URL) |
| **Config** | `name`, `config` (JSON), `version` |

Schema permissions: Admin/Config extendable; ApiToken/TwoFactorSecret locked down.

### Default admin bootstrap

When database becomes available, if no `username: admin` exists, creates:

- Username: `admin`
- Password: `admin` (hashed)
- `isSuperAdmin: true`

### Auth mechanisms

| Mechanism | Header | Use case |
|-----------|--------|----------|
| Master key | `masterkey: {MASTER_KEY}` | Bootstrap, automation, MCP (with Bearer for tool calls) |
| JWT session | `Authorization: Bearer {jwt}` | Admin UI / human operators after `/login` |
| API token | `Authorization: Bearer cdt_{...}` | Long-lived automation; bypasses masterkey in admin middleware |

JWT payload: `{ id, twoFaRequired? }`; signed with `admin.auth.tokenSecret`.

### SuperAdmin capabilities

- Create/delete admins
- Change other admins' passwords
- (Implicit) full access to all authenticated admin routes

---

## Health & Metrics

### gRPC health (`grpc.health.v1.Health`)

Core registers health service on its gRPC server. Services:

- `conduit.core.Config`
- `conduit.core.Admin`

Status tracked in `GrpcServer._serviceHealthState`; emits `grpc-health-change:Core` for watchers. Metric: `module_health_state` gauge (1=SERVING, 0=otherwise).

### HTTP readiness

- `GET /ready` — simple string response, no dependency checks

### MCP health

- `GET /mcp/health` — JSON with tool/module/resource counts

### Prometheus metrics

Enabled when `METRICS_PORT` is set.

**Core-registered:**

| Metric | Type | Labels |
|--------|------|--------|
| `admin_routes_total` | Gauge | `transport` (e.g. `mcp`) |
| `module_health_state` | Gauge | — |

**module-tools defaults** (when metrics enabled on any module via grpc-sdk):

`internal_grpc_requests_total`, `client_grpc_requests_total`, `admin_grpc_requests_total`, error counters, latency gauges, response status counters.

Metrics server: `GET /` (info), `GET /metrics` (Prometheus text).

---

## Module Lifecycle

### Module → Core registration (`ManagedModule` in module-tools)

| Stage | Hook / action |
|-------|----------------|
| `CREATE_GRPC` | Construct SDK with `CONDUIT_SERVER`, create local gRPC server |
| `PRE_SERVER_START` | Before gRPC bind |
| `SERVER_STARTED` | Bus + state online; `onServerStart()` |
| `PRE_REGISTER` | `preRegister()` |
| `POST_REGISTER` | `config.registerModule()` → `onRegister()` — register admin/client routes |
| Config | `configure()` via Core; `preConfig()` / `onConfig()` on updates |
| Peers | Optional `conduitPeers` manifest: `awaitPeersFromManifest()`, peer watches |

### Core-side lifecycle

1. **gRPC `RegisterModule`** — add to registry, create module client in sdk, persist state
2. **`Configure`** — store config, expose `/config/{name}` routes
3. **`RegisterAdminRoute`** (Admin gRPC) — module publishes admin REST routes; Core proxies to module gRPC
4. **Health** — module probes Core; monitor polls module
5. **Database wait** — Core blocks admin middleware DB apply until `database` module active

### Admin route registration (modules)

Modules use `RoutingManager` → `grpcSdk.admin.register(routes, serverUrl)`.

Core:

- Converts proto route definitions to Hermes `ConduitRoute` via `grpcToConduitRoute`
- Stores in `_grpcRoutes[routerUrl]`
- Persists to Redis state `routes[]`
- Broadcasts on bus channel `admin` for multi-Core HA
- Cleans up stale routes via `cleanupRoutes()`

### State export/import (GitOps)

Modules may implement gRPC `getExportableResources`, `exportResources`, `importResources`. Core orchestrates via `/state/export` and `/state/import`. `module-tools` provides `exportHelpers` (`stripInternalFields`, `exportModel`, `importModel`).

---

## gRPC / SDK Surface

### Proto: `packages/core/src/core.proto`

**Services:**

| Service | RPCs |
|---------|------|
| `Core` | (empty placeholder) |
| `Config` | `Get`, `Configure`, `ModuleExists`, `ModuleList`, `WatchModules`, `RegisterModule`, `ModuleHealthProbe`, `GetServerConfig`, `GetRedisDetails`, `GetModuleUrlByName` |
| `Admin` | `RegisterAdminRoute`, `PatchRouteMiddlewares` |

Route registration messages support full Conduit route metadata: params, middlewares, errors, `mcp` flag, `rateLimit`, **proxy options** (for module-defined proxy routes).

### grpc-sdk clients

| Client | Class | Key methods |
|--------|-------|-------------|
| Config | `libraries/grpc-sdk/src/modules/config/` | `get`, `configure`, `registerModule`, `moduleList`, `watchModules`, `moduleHealthProbe`, `getRedisDetails`, `getModuleUrlByName` |
| Admin | `libraries/grpc-sdk/src/modules/admin/` | `register`, `patchRouteMiddlewares` |
| Core | `libraries/grpc-sdk/src/modules/core/` | Thin `ConduitModule` wrapper |

### ConduitGrpcSdk platform utilities

| Utility | Purpose |
|---------|---------|
| `EventBus` | Redis pub/sub with `CND_Signature` echo suppression |
| `StateManager` | Redlock-guarded `modifyState`, key/value storage |
| `RedisManager` | Connection pooling, key prefixes |
| `checkModuleHealth` | Standalone health client with optional `GRPC_KEY` signing |
| `waitForExistence` / `awaitPeer` | Block until module registered (and optionally serving) |
| `updateModuleHealth` | Local cache of module serving state |
| Interceptors | `grpcSignedToken` (`GRPC_KEY`), `moduleName` metadata |

### module-tools surface

| Export | Purpose |
|--------|---------|
| `ManagedModule` | Standard module bootstrap |
| `GrpcServer` | Proto service registration, graceful restart |
| `ConfigController` | Singleton runtime config for handlers |
| `RoutingManager` / `RoutingController` | Admin + client route builders |
| `ConduitActiveSchema` | DB model base used by Core schemas |
| `initializeSdk` | Logger, Loki, metrics middleware setup |
| `merge`, `convictConfigParser` | Config utilities |

### Hermes surface (used by Core Admin)

| Component | Purpose |
|-----------|---------|
| `ConduitRoutingController` | Multi-transport router |
| `Rest` + Swagger | OpenAPI generation |
| `GraphQL` | Admin GraphQL |
| `Socket` | Socket.io admin events |
| `MCPController` | MCP server, tool/resource registries |
| `RouteToTool` | Auto-convert admin routes → MCP tools |
| `grpcToConduitRoute` | Proto routes → Hermes routes |

---

## Integration Points

### Redis event bus channels (Core-relevant)

| Channel | Publisher | Purpose |
|---------|-----------|---------|
| `config` | ServiceDiscovery, ConfigStorage | Module health, serving updates, reconcile status |
| `admin` | AdminModule | Route registration HA |
| `admin:config:update` | ConfigManager | Admin config reload |
| `core:config:update` | Core, AdminModule | Core config reload |
| `{module}:config:update` | ConfigStorage | Push config to live modules |

### Security integration

| Feature | Implementation |
|---------|----------------|
| Master key | Env `MASTER_KEY`, header `masterkey` |
| gRPC signing | Env `GRPC_KEY` → JWT on internal gRPC calls |
| Helmet | HTTP security headers (CSP relaxed for docs routes) |
| CORS | Configurable per admin config |
| MCP origin validation | `MCPController` validates request origin |

### External tooling

| Tool | Integration |
|------|-------------|
| Conduit Admin UI | Calls Admin REST with masterkey + JWT |
| Cursor MCP | `https://host:port/mcp?modules=...` with Bearer token |
| Prometheus | Scrape `METRICS_PORT/metrics` |
| GitOps / CLI | `/state/export`, `/state/import`, `/config/import` |

### Multi-Core instances

State modifications use Redlock (`STATE_MODIFICATION`). Route and module state recovered from Redis. Config reconciliation uses jittered interval to reduce races.

---

## Feature Matrix

| Capability | Core package | grpc-sdk | hermes | module-tools |
|------------|:------------:|:--------:|:------:|:------------:|
| gRPC Config service | ✓ | Client | — | — |
| gRPC Admin service | ✓ | Client | — | Route registration |
| Service discovery / registry | ✓ | Client + health | — | `registerModule` in `ManagedModule` |
| Health monitoring / revive | ✓ | `checkModuleHealth` | — | Default health service |
| Module config CRUD | ✓ | `configure` / `get` | MCP tools via routes | `setConfig` gRPC handler |
| Redis state / bus | ✓ | `StateManager`, `EventBus` | — | — |
| Config DB reconciliation | ✓ | — | — | — |
| Admin REST API | ✓ | — | `Rest` | Route builders |
| Admin GraphQL | ✓ | — | `GraphQL` | — |
| Admin WebSockets | ✓ | — | `Socket` | — |
| Admin MCP server | ✓ (enable) | — | `MCPController` | — |
| Swagger / OpenAPI | ✓ | — | `Swagger` | — |
| Admin user CRUD | ✓ | — | Routes | — |
| JWT login / 2FA | ✓ | — | Routes | — |
| API tokens (`cdt_`) | ✓ | — | Routes | — |
| Master key auth | ✓ | — | Middleware | — |
| Route middleware inject/persist | ✓ | `patchRouteMiddlewares` | `patchRouteMiddlewares` | — |
| State export/import | ✓ | Module clients | — | `exportHelpers` |
| Prometheus metrics | ✓ | `IConduitMetrics` | Route trie metrics | `MetricsServer`, defaults |
| Default admin seed | ✓ | — | — | — |
| HA route/module recovery | ✓ | — | — | — |
| Proxy admin routes | Proto support | — | Proxy route options in proto | — |
| Client API routing | — | Router module client | `Router` module uses Hermes | `RoutingManager` |

---

## Open Questions

1. **Resolved** — MCP tool naming — Canonical tool names are `getconfig_<module>` and `patchconfig_<module>` (no underscore after action). Update conduit-mcp skill docs accordingly.

2. **Default gRPC port discrepancy** — `README.mdx` lists default `GRPC_PORT=55190`; `bin/www.ts` defaults to `55152`. Which is authoritative for deployments?

3. **In plan** — `/ready` depth — Implement **deep** readiness probe (verify Redis, database, registered modules); replace shallow `/ready`.

4. **Core config import** — `POST /config/import` explicitly rejects `core` module updates. Is there an supported path to mutate `core.env` at runtime?

6. **`GET /config/modules` error** — Returns 500 when zero modules registered; should empty list be valid during startup?

7. **GraphQL admin surface** — Default off; full list of core-exposed GraphQL operations not enumerated in core package (generated from registered routes). Document separately?

8. **Multi-instance module URLs** — Code comment states load balancing across multiple instances of the same module is not supported. Is horizontal scaling expected via external LB only?

9. **`toggle-twofa` return type** — Enable path returns raw QR string in one branch vs `{ message }` object in disable path; intentional?

10. **Hermes README** references `packages/admin` — that package may be legacy naming; confirm whether `packages/core` fully subsumed the old admin package.
