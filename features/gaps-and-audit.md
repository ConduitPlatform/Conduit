# Conduit Platform — Second-Pass Audit

> **Purpose:** Capabilities missed in the first `features/*.md` pass, plus consolidated gaps, drifts, and open questions.  
> **Generated:** Second-pass source audit (modules, core, Hermes, grpc-sdk, Conduit-UI, Conduit-Website, CLI, conduit-payments, conduit-operator).  
> **Companion docs:** See per-module references in [README.md](./README.md).  
> **Implementation plans:** [implementation-plans/](./implementation-plans/)  
> **Platform libraries:** [platform-libs/](./platform-libs/)

---

## Executive summary

The first pass produced solid coverage of the **eight first-party modules** in `Conduit/modules/` plus **core**. This pass found:

1. **Whole products/repos not catalogued** — `conduit-operator`, **CLI GitOps** workflows; `conduit-payments` is customer-specific and **out of platform scope**.
2. **Systematic doc/UI/code drift** — Conduit-UI and v0.16 website docs describe routes and features that do not exist in current module source (especially chat, storage, functions).
3. **Proto vs wiring gaps** — RPCs declared in `.proto` but not registered in `service.functions` (authentication).
4. **Config keys with no runtime effect** — communications orchestration retry settings; email cleanup job scheduler.
5. **MCP surface incomplete** — Several admin routes exist but are excluded from MCP (`mcp: false`) or missing from skill inventories; tool naming does not match skill docs (**partially resolved** — see [Product decisions](#product-decisions-resolved)).

Use this document when extending `features/*.md` or filing fix tickets. Resolved product decisions are recorded in the section below; open questions retain historical audit text with **status** annotations.

---

## Product decisions (resolved)

Decisions from the second-pass review (June 2026). These supersede conflicting recommendations elsewhere in this file unless noted.

### Platform scope

| Topic | Decision |
|-------|----------|
| **`conduit-payments`** | **Out of scope** for platform feature catalog — customer-specific module. Do **not** add `features/payments.md`. |
| **`features/` expansion** | Add platform library docs under [platform-libs/](./platform-libs/) — Hermes, grpc-sdk, module-tools. |
| **GitOps / CLI state** | Export **config + declarative resources only**. Never export runtime data (relations, indexes, router routes, chat rooms). |
| **Deployment** | [conduit-helm-charts](https://github.com/ConduitPlatform/conduit-helm-charts) is **primary**; [conduit-operator](https://github.com/ConduitPlatform/conduit-operator) is **secondary**. |

### Bug fixes — confirmed for implementation

All **11 bugs** are approved for implementation. Track in [implementation-plans/bug-fix-batch.plan.md](./implementation-plans/bug-fix-batch.plan.md).

| Area | Item |
|------|------|
| **Auth** | 2FA `sms` vs `phone` naming; backup codes `.enabled` gate; `UserCreateByUsername` — wire gRPC or remove from proto |
| **Authz** | Admin `DELETE` resource cascade; `POST /relations/many` body vs params binding; `FindRelation` error message vs logic |
| **Other** | Database custom endpoint op 8 (`$contains` vs duplicate `$nin`); Functions `PUT` method mapping; SMS `provider` always `unknown`; email status SendGrid stub; Azure `deleteFolder` metric |

### UI and documentation

| Topic | Decision |
|-------|----------|
| **Conduit-UI communications** | Fix UI API clients to match communications module paths — **no backend compatibility shims**. |
| **Router proxy UI** | **Implemented** — removed in [router-proxy-cleanup.plan.md](./implementation-plans/router-proxy-cleanup.plan.md). |
| **Conduit-Website** | v0.16 docs are valid **for 0.16 only**; current platform is **0.17**. |
| **conduit-mcp skill** | Fix skill naming to match generated tools: `getconfig_*` (not `get_config_*`). |

### Partial features — implementation direction

| Item | Decision |
|------|----------|
| **Functions cron** | **Implement** scheduler (schema + UI already exist). |
| **Communications unified templates** | **Implement** CRUD + orchestrator resolution. |
| **`transports.proxy`** | **Implemented** — removed from router + admin config in [router-proxy-cleanup.plan.md](./implementation-plans/router-proxy-cleanup.plan.md). |
| **Storage GCS provider** | **Rewrite** — current class is deprecated/incomplete. |
| **Database vector search** | **Feature-flag** and document as **not shipped** (contract test only). |

### Policy and product behavior

| Topic | Decision |
|-------|----------|
| **Chat invitations** | Login required; accept uses `redirectUri`; Conduit appends token query param on redirect for app-side accept. |
| **Service accounts** | **Remove feature entirely** — unused. |
| **Team delete** | Client API should match admin reparent behavior and **require sudo**. |
| **Chat admin bulk delete** | Add socket/bus notifications (parity with client delete paths). |
| **MCP surface** | Keep DB introspect/import **excluded**; **expose** authz bulk (`relations/many`) + `indexer/reconstruct`. |
| **Readiness** | Implement **deep** readiness probe (replace shallow `/ready`). |

---

## Modules and repos not in `features/`

### `conduit-payments` (custom module — **out of platform scope**)

> **Status: Resolved** — Customer-specific; not part of platform feature catalog. Do not add `features/payments.md`.

Separate repository: `/Users/kkopanidis/WebstormProjects/conduit-payments`

| Area | Capability | Evidence |
|------|------------|----------|
| gRPC | `payments.Payments` — Stripe create/cancel/refund, Piraeus create, balances credit/update/remove | `src/payments.proto`, `src/Payments.ts` |
| Providers | Stripe, Piraeus, Viva, RevenueCat integration | `src/providers/`, `src/integrations/RevenueCat/` |
| Client routes | Stripe, Piraeus, Viva, RevenueCat webhooks and payment flows | `src/routes/` |
| Admin | Product/subscription/transaction admin handlers | `src/admin/admin.ts` |
| Models | `Product`, `Subscription`, `Transaction`, `PaymentsCustomer`, `CustomerBalance`, `CardToken`, `RedeemCode` | `src/models/` |
| Jobs | Subscription, balance expiry, expired redeem codes | `src/jobs/` |
| Templates | Transaction success/failure email templates | `src/templates/` |
| Metrics | Dedicated `metricsSchema` | `src/metrics/index.ts` |

~~**Action:** Add `features/payments.md` if this module is considered part of the platform product surface.~~ **Resolved:** Out of scope for platform catalog.

### `conduit-operator` (Kubernetes — **secondary deployment path**)

> **Status: Resolved** — Helm charts primary; operator secondary. Add deployment notes to platform docs, not a full operator feature catalog unless needed.

Repository: `/Users/kkopanidis/WebstormProjects/conduit-operator`

| Capability | Notes |
|------------|-------|
| CRD `Conduit` (`conduit.conduit.io/v1`) | Declarative full-stack deployment |
| Managed components | Core, Admin UI, Router, Database, Redis, MongoDB, microservices |
| Ingress examples | `examples/ingress-example/` |
| Lifecycle | Deploy, scale, status, resource limits, service discovery, Prometheus |

**Drift:** Operator README positions itself as replacing Helm charts; `conduit-helm-charts` still exists — **Resolved:** Helm is primary deployment path; operator is secondary. Document relationship in deployment docs.

### CLI GitOps (`CLI` repo — **partially mentioned in core.md only**)

> **Status: Resolved** — Export **config + declarative resources only**; never export runtime data (relations, indexes, router routes, chat rooms).

| Command | Capability |
|---------|------------|
| `conduit state pull` | Export configs + module resources to `.conduit/` |
| `conduit state push` | Import with `--dry-run`, `--configs-only`, `--modules-only` |
| `conduit state diff` | Drift detection; `--fail-on-drift` for CI |
| `conduit project up` | Local stack from manifest; optional auto `state push` |
| `conduit init` | Admin URL + `cdt_` API token bootstrap |

Workflow example: `.github/workflows/conduit-state-apply.yml` in CLI repo.

**Missed in module docs:** Per-module export **priority** ordering during import (auth 35, communications 30, storage 25, database 10–20, functions 40, authorization 5) — only listed piecemeal.

---

## Missed features by first-party module

### Authentication

| Missed / under-documented | Evidence |
|---------------------------|----------|
| **OAuth client-token POST routes** (mobile/SDK flows, distinct from Apple native) | `POST /authentication/google`, `POST /authentication/facebook` — `handlers/oauth2/google/google.ts`, `facebook/facebook.ts` |
| **Microsoft `tenantId` config** for single-tenant apps | `config/microsoft.config.ts` |
| **Per-route rate limits** `MAGIC_LINK_EXCHANGE`, `PHONE_CODE_VERIFY` (25/900s) | `constants/routeRateLimits.ts` |
| **Cookie option keys** `signed`, `domain`, `path`, `sameSite` on access/refresh tokens | `config/token.config.ts` |
| **`preConfig` strips** `captcha.provider`, `captcha.secretKey`, cookie `maxAge` | `Authentication.ts` |
| **Email template auto-registration** on module start (6 templates) | `handlers/local.ts` → `templates/index.ts`: `ForgotPassword`, `VerifyEmail`, `VerifyChangeEmail`, `MagicLink`, `TeamInvite`, `VerifyEmailWithCode` |
| **`UserCreateByUsername` gRPC** in proto, **not** in `service.functions` | `authentication.proto:136` vs `Authentication.ts:75-91` — **In plan:** wire or remove |
| **`userCreateByUsername` handler may exist** but unwired — dead RPC surface | Search `userCreateByUsername` in `Authentication.ts` |
| **Platform-specific captcha** — middleware checks WEB/ANDROID, not IOS explicitly | `captchaMiddleware` paths |
| **Logged-in users Redis ZSET** for metrics | `logged_in_users` key, 5-minute cleanup |
| **Communications migration** — module watches legacy `email` peer name | grpc-sdk legacy connection map |

### Authorization

| Missed / under-documented | Evidence |
|---------------------------|----------|
| **MCP-excluded but UI-used routes** | `POST /authorization/relations/many`, `POST /authorization/indexer/reconstruct` — **Resolved:** expose via MCP; update skill inventory |
| **Admin `DELETE /resources/:id`** does not cascade (unlike gRPC `DeleteResource`) | `admin/` handlers vs `ResourceController.deleteResource` — **In plan:** fix cascade |
| **Metrics schema vs registration** — counters emitted but `initializeMetrics()` commented out | `Authorization.ts`, `metrics/index.ts` |
| **Rule cache Redis keys** | `ruleCache:{globalVer}:{subjectVer}:{tuple}` — TTL 60s / 7d documented in features but worth cross-linking to `grpcSdk.state` |

### Chat

| Missed / under-documented | Evidence |
|---------------------------|----------|
| **Admin API routes exist but were omitted from `features/chat.md`** | `admin/index.ts`: `GET /chat/rooms/:id`, `PUT /chat/rooms/:roomId/add`, `PUT /chat/room/:roomId/remove` (singular `room`), `GET/DELETE /chat/invitations/:roomId` — Conduit-UI matches these paths |
| **First-pass Open Question #1 was incorrect** | Claimed admin add/remove routes missing; they are registered on Admin API under `/chat/*` (not `/admin/chat/*`) |
| **`GET /chat/rooms` admin filters** | Supports `users[]`, `deleted` — not only `search` |
| **Socket `connectToRoom`**, structured `MessageResponse` return schema | `routes/index.ts` |
| **Invitation hook rate limit** | 50 req / 3600s |
| **Metrics seed on startup** | `messages_sent_total` initialized from DB count |
| **Admin delete bus/socket gap** | Admin bulk delete does not publish bus events or socket pushes — **In plan:** add notifications |
| **Hook invitation auth paradox** | Route registered without `authMiddleware` but handler reads `context.user` |
| **`populate` on client room routes** | Handlers support it; route schema omits query param |
| **README socket API outdated** | `modules/chat/README.mdx` vs current `SocketRoutes` |

### Communications

| Missed / under-documented | Evidence |
|---------------------------|----------|
| **Legacy config migration** on first `preConfig` | `legacyConfigMigration.ts` merges old `email`/`pushNotifications`/`sms` namespaces |
| **grpc-sdk triple alias** | `grpcSdk.email`, `.pushNotifications`, `.sms` all route to communications service |
| **Mailgun `domain` in provider code** | Used in provider; not in convict schema defaults |
| **Chat invitation template** | Chat module registers `ChatRoomInvitation` when explicit joins + email enabled (cross-module) |
| **Amazon SES / SMTP status exclusion** | `getEmailStatus.ts` provider map |
| **No module-level `active`** — only per-channel toggles | `config/config.ts` |
| **Client inbox `unreadCount`** in `GET /notifications` | `routes/push-notifications.routes.ts` |
| **Mailgun `proxy` transport setting** | `config/config.ts` |
| **No Redis bus events** in communications module | — |

**Conduit-UI drift (communications backend is correct; UI is stale):**

> **Status: Resolved** — Fix Conduit-UI API clients to communications paths; no backend shims.

| UI path | Backend reality |
|---------|-----------------|
| `/pushNotifications/token`, `/send`, `/sendToManyDevices`, … | Client `/token`, `/notifications`; Admin `/push/*` |
| `/email/externalTemplates`, `PATCH /email/syncExternalTemplates` | `/email/templates/external`, `POST .../external/sync` |
| `GET /email/status`, `GET /email/record` | `GET /email/emails`, `GET /email/emails/:id` |
| Resend body `{ emailRecordId }` | Admin expects `{ id }` |

### Core

| Missed / under-documented | Evidence |
|---------------------------|----------|
| **MCP ResourceRegistry** — read-only MCP resources | `libraries/hermes/src/MCP/ResourceRegistry.ts`: Admin OpenAPI, Client OpenAPI, API guide (`conduit://docs/*`) |
| **`GET /mcp/health`** | MCP subsystem health JSON |
| **Admin vs Client middleware persistence split** | Core: `AdminMiddleware` + `/patch-middleware`; Router: `AppMiddleware` + `/router/patch-middleware` |
| **SuperAdmin-only routes** | Create/delete admin, change other admin password |
| **`ConfigImport` vs `StateImport`** | Bulk config import rejects `core`; state import orchestrates modules |

### Database

| Missed / under-documented | Evidence |
|---------------------------|----------|
| **MCP-disabled admin routes** (explicit `mcp: false`) | `POST /schemas/import`, all `/introspection/*` — **Resolved:** keep excluded from MCP |
| **Custom endpoint operation `8`** | Labeled "contain" in UI/docs; code maps to `$nin` (duplicate of op 7) — **In plan:** fix op 8 |
| **`database_query_errors_total`** | Metric commented out pending global error handler |
| **Replica mode** | Skips migrations when another database instance exists (`isReplica`) |
| **Legacy `cnd_` collection prefix** | `hasLegacyCollections()` migration path |
| **`GenerateId` proto return type** | Returns `GetDatabaseTypeResponse` type in proto (likely copy-paste error) |
| **GraphQL type sync on authorization views** | Views may not publish GraphQL schema updates |

### Functions

| Missed / under-documented | Evidence |
|---------------------------|----------|
| **No grpc-sdk client** | `libraries/grpc-sdk/src/modules/` has no `functions/` export |
| **`PUT` HTTP method mapping bug** | `getOperation()` checks `'UPDATE'` not `'PUT'` — **In plan** |
| **No `FunctionExecutions` retention/TTL** | Collection grows unbounded |
| **No test/replay admin endpoint** | Conduit-UI notes absence |
| **Website example wrong URL** | Admin port + `/function/` vs Client `/hook/functions/` |

### Router

| Missed / under-documented | Evidence |
|---------------------------|----------|
| **Conduit-UI proxy CRUD** — full UI, **zero backend** | `Conduit-UI/src/lib/api/router/index.ts` → `/router/proxy*` — **Implemented:** removed in [router-proxy-cleanup.plan.md](./implementation-plans/router-proxy-cleanup.plan.md) |
| **`RouterBuilder` / `RouteBuilder`** | Exported, unused, buggy (`construct()` wires all verbs to `.get`) |
| **Global rate limit OPTIONS handling** | May increment counter after `next()` without early return |
| **Per-route vs global fail-open/fail-closed asymmetry** | Documented in open questions; operational implication for Redis outages |
| **100MB gRPC message limits** | Hermes client to module handlers |

### Storage

| Missed / under-documented | Evidence |
|---------------------------|----------|
| **Presigned upload completion** | No finalize endpoint; `PENDING UPLOAD` placeholder if client never PUTs |
| **Post-upload size not updated** | `File.size` set at metadata creation only |
| **Website v0.16 drift** | Multipart upload, `/storage/download/:id`, client folder routes, `/admin/storage/stats` — not in code |
| **Azure blob ACL on upload** | `isPublic` param not applied per-object (container-level only) |
| **GitOps exports metadata only** | No file blobs or `File` records in export |

---

## Cross-cutting missed features

### Hermes (`libraries/hermes`) — not fully attributed

> **Status: Resolved** — Document under [platform-libs/](./platform-libs/) (Hermes, grpc-sdk, module-tools).

| Capability | Where used | In features? |
|------------|------------|--------------|
| MCP Streamable HTTP + SSE | Core Admin `:3030/mcp` | Partial (core.md) |
| MCP resources (OpenAPI ×2, API guide) | `ResourceRegistry` | **Missing detail** |
| Scalar `/reference` | Client + Admin REST | router.md ✓ |
| GraphQL Playground (non-prod) | Both gateways | Partial |
| Zod param validation (`strictParams`) | RestController | router.md ✓ |
| Response cache via Redis (`grpcSdk.state`) | GET routes | router.md ✓ |
| `connectionStateRecovery` (Socket.io) | Chat + router | chat.md ✓ |
| Route cleanup debounce (1s) + middleware reapply (3s) | Router HA | router.md ✓ |

### grpc-sdk (`libraries/grpc-sdk`)

> See planned docs: [platform-libs/](./platform-libs/)

| Client | Notes |
|--------|-------|
| `grpcSdk.communications` | Unified client; legacy `email`/`pushNotifications`/`sms` still exported |
| `grpcSdk.state` | `StateManager` — Redlock, route HA state, rate limits, cache; under-documented outside router/core |
| `grpcSdk.admin` | `patchRouteMiddlewares` for admin routes |
| **No `grpcSdk.functions`** | Functions module admin-only via HTTP/MCP |

### MCP tool gaps

| Gap | Detail |
|-----|--------|
| **Tool naming** | Skills say `get_config_<module>`; generator produces `getconfig_<module>` — **Resolved:** fix skill to `getconfig_*` |
| **Database introspection** | All introspection routes `mcp: false` — **Resolved:** keep excluded |
| **Schema import** | `POST /database/schemas/import` — `mcp: false` — **Resolved:** keep excluded |
| **Authorization bulk/index** | `relations/many`, `indexer/reconstruct` — **Resolved:** expose via MCP + skill inventory |
| **Functions module** | Requires explicit `?modules=functions`; tools auto-generated (see `features/functions.md`) — **first pass incorrectly said none** |
| **Login/password/2FA admin routes** | Correctly `mcp: false` — agents cannot self-bootstrap human admin sessions |

### Ecosystem not in `features/` (cross-cutting audit)

| Surface | Gap |
|---------|-----|
| **`conduit-payments`** | Separate repo; Stripe/Piraeus/Viva/RevenueCat; Conduit-UI nav — **Resolved:** out of platform catalog scope |
| **`conduit-operator`** | K8s CRD; still lists legacy **forms** microservice — **Resolved:** secondary to Helm |
| **Forms module** | Removed from monorepo; operator CRD remnant |
| **CLI** | `state pull/push/diff`, `project up`, `.conduit/` layout — one-line mention in core.md only |
| **`libraries/node-2fa`** | Admin TOTP in core — not in `features/core.md` |
| **`registerDynamicModule`** | grpc-sdk pattern for custom modules (payments) — undocumented in features |
| **Platform metrics catalog** | Per-module schemas exist; no unified index |
| **Bus event registry** | Partial per module; `database:*Many:*`, config reconcile, router HA under-documented |

### GitOps export types (complete registry)

> **Policy (Resolved):** Config + declarative resources only. Runtime data below marked **not exportable** must never be added to CLI state export.

| Module | Export type(s) | Priority |
|--------|----------------|----------|
| database | `schemas`, `extensions`, `customEndpoints` | 10, 15, 20 |
| storage | `containers`, `folders` | 25 |
| communications | `emailTemplates`, `communicationTemplates` | 30 |
| authentication | `teams` | 35 |
| functions | `functions` | 40 |
| authorization | `resourceDefinitions` | 5 |

**Not exportable:** chat, router, storage file blobs, communications send history, function execution logs.

### Bus event catalog gaps (events in code, sparse in features)

| Event | Publisher | Documented? |
|-------|-----------|-----------|
| `database:customSchema:create` / `update` | schema.controller | Partial |
| `database:customEndpoints:refresh` | customEndpoint.controller | Partial |
| `functions` (empty payload) | function.controller | functions.md ✓ |
| `router` / `router-ha` | Router.ts | router.md partial |
| Chat admin delete events | admin/index.ts | **Missing** — admin delete may not publish |

---

## Documentation drift matrix

| Source | Claims | Code reality | Severity |
|--------|--------|--------------|----------|
| **Conduit-Website v0.16** | Authorization RBAC `/roles`, `/rules` | ReBAC only in current module | High — **Resolved:** v0.16 docs valid for 0.16 only; current is 0.17 |
| **Conduit-Website v0.16 storage** | Multipart, `/download/:id`, `/stats` | Not implemented | High — **Resolved:** version-scoped docs only |
| **Conduit-Website v0.16 chat** | `GET /rooms/{id}/messages`, socket `join`/`leave` emits | Different paths/events | High — **Resolved:** version-scoped docs only |
| **Conduit-Website functions** | Webhook on Admin API `:3030/function/...` | Client API `/hook/functions/...` | Medium |
| **features/chat.md (first pass)** | Open Q#1: admin add/remove “missing” | Routes exist at `/chat/rooms/:id/add`, `/chat/room/:id/remove` | **Doc error** — fix `chat.md` |
| **Conduit-UI communications** | Legacy `/pushNotifications/*`, mismatched `/email/*` paths | Communications module `/push/*`, `/email/*` | **Resolved:** fix UI paths (no backend shims) |
| **Conduit-UI router** | Full proxy route CRUD | No backend handlers | **Implemented:** removed in [router-proxy-cleanup.plan.md](./implementation-plans/router-proxy-cleanup.plan.md) |
| **conduit-mcp skill** | `get_config_<module>` tool names | `getconfig_<module>` generated | **Resolved:** fix skill naming |
| **database README** | Sequelize: no indexes | Index CRUD implemented | Medium |
| **authentication features** | Template names list | Slight name mismatch vs code exports | Low |
| **Operator README** | Replaces Helm | Both coexist | **Resolved:** Helm primary, operator secondary |

---

## Partial implementations (config/code exists, behavior incomplete)

| Location | What exists | What's missing | Status |
|----------|-------------|----------------|--------|
| `functions` cron type | Schema + UI | Scheduler (`//todo` in route handler) | **In plan:** implement |
| `communications` orchestration | Config keys | Retry/delay/timeout not applied in orchestrator | Open |
| `communications` email cleanup | `addEmailCleanupJob()` | Never scheduled from lifecycle | Open |
| `communications` email status job | BullMQ worker | Hardcoded SendGrid stub | **In plan:** fix stub |
| `communications` unified templates | Schema + gRPC stub | No CRUD, no orchestrator resolution | **In plan:** implement |
| `router` / `admin` `transports.proxy` | Config flag | No init/stop logic | **Implemented:** removed in [router-proxy-cleanup.plan.md](./implementation-plans/router-proxy-cleanup.plan.md) |
| `authorization` metrics | Schema + runtime increments | `initializeMetrics()` commented out | Open |
| `storage` GCS provider | Class present | `@Deprecated`, incomplete deletes | **In plan:** rewrite |
| `database` vector search | Contract test | Not in proto/SDK | **Deferred:** feature-flag; document not shipped |

---

## Consolidated open questions

All items from per-module `## Open Questions` sections are retained here for single-file review. See individual `features/{module}.md` for full context.

**Status legend:** **Resolved** = product decision made; **In plan** = approved for implementation ([bug-fix-batch](./implementation-plans/bug-fix-batch.plan.md) or feature work); **Deferred** = explicitly not shipping now; *(no tag)* = still open.

### Authentication (10)
- **In plan** — 2FA `sms` vs `phone` naming; backup codes gate on object vs `.enabled`
- Hook path prefix mapping (`/hook/` vs `/hook/authentication/`)
- **In plan** — `UserCreateByUsername` gRPC unwired (wire or remove)
- Apple OAuth stub / special-case flows
- **Resolved** — Service account vs human user token distinction → **remove service accounts feature**
- **Resolved** — Team delete admin vs client `parentTeam` behavior → client matches admin reparent + sudo
- Captcha on iOS
- Empty migrations stub
- OAuth `responseMode` defaults per provider

### Authorization (10)
- **In plan** — Admin DELETE resource vs gRPC cascade
- **In plan** — `POST /relations/many` body vs params binding
- Dual owner tuples on scoped creates
- Metrics registration
- Empty migrations
- `deleteAllRelations` swallows errors
- **In plan** — `FindRelation` validation message vs logic
- **Resolved** — MCP tool inventory gaps → expose `relations/many` + `indexer/reconstruct`

### Chat (12)
- Admin UI route mismatch
- Admin `search` param ignored
- `ChatParticipantsLog` enum drift
- Invitation count pagination
- gRPC vs REST room create parity
- **In plan** — Admin delete side effects (no socket/bus) → add notifications
- Membership cache on invite accept
- README socket API outdated
- **Resolved** — Hook invitation auth model → login required; `redirectUri` accept with token param on redirect
- Empty migrations

### Communications (12)
- **In plan** — `RegisterCommunicationTemplate` placeholder → implement unified templates
- Orchestrator `templateName` unused
- Email cleanup job not scheduled
- **In plan** — Email status job stub (SendGrid hardcode)
- **In plan** — `SmsRecord.provider` always `unknown`
- Orchestration config unused
- Unified metrics not incremented
- Push status always `sent`
- SES/SMTP status polling excluded
- **Resolved** — Legacy `/pushNotifications/*` paths → fix Conduit-UI (no backend shims)

### Core (10)
- **Resolved** — MCP tool naming → skill uses `getconfig_*`
- **Implemented** — `transports.proxy` removed in [router-proxy-cleanup.plan.md](./implementation-plans/router-proxy-cleanup.plan.md)
- Default `GRPC_PORT` 55190 vs 55152
- **In plan** — Shallow `/ready` → implement deep readiness probe
- Core config import rejection
- `/config/modules` 500 on empty
- Admin GraphQL surface not enumerated
- Multi-instance LB limitation
- `toggle-twofa` return shape
- `packages/admin` legacy naming

### Database (10)
- **Deferred** — Vector search RPCs (test-only) → feature-flag; document not shipped
- GraphQL ownership attribution
- Sequelize index README drift
- SQL LIKE/`$ilike` dialect behavior
- `setSchemaPerms` merge target
- Custom endpoint PUT returns `['Ok']` only
- Replica migration semantics
- Legacy collection prefix
- Query error metric commented out
- GraphQL sync on authorization views
- **In plan** — Custom endpoint op 8 (`$contains` vs duplicate `$nin`) — see bug-fix batch

### Functions (12)
- **In plan** — Cron unimplemented → implement scheduler
- Socket `inputs.event` UI gap
- Event unsubscribe on delete
- `functionType` immutability
- Webhook auth ignored
- Execution response schema mismatch
- MCP coverage scope
- Return type schema mapping
- Multi-instance event subscription races
- Execution retention policy
- Test/replay endpoint absence
- **In plan** — `PUT` HTTP method mapping bug

### Router (10)
- **Implemented** — Client `transports.proxy` and empty `proxyRoutes` removed in [router-proxy-cleanup.plan.md](./implementation-plans/router-proxy-cleanup.plan.md)
- MCP admin-only by design?
- Captcha non-blocking globally
- Global vs per-route rate limit fail modes
- Empty migrations
- Unused builders
- OPTIONS rate limit behavior
- Website rate-limit toggle docs

### Storage (14)
- **In plan** — GCS deprecation status → rewrite provider
- Local presigned flow
- Proto `int32` size limit
- Folder `url` field purpose
- **In plan** — Azure delete metric bug
- Aliyun double-decrement risk
- Empty migrations
- File schema rename TODO
- Admin delete response type mismatch
- Presigned upload completion
- Azure per-object ACL
- **Resolved** — Website API drift → v0.16 docs version-scoped only
- GitOps blob exclusion — **Resolved:** by policy (no runtime export)

---

## Recommended follow-ups

> Many items below are superseded by **[Product decisions (resolved)](#product-decisions-resolved)**. Historical list retained for audit trail.

### Documentation
1. ~~Add `features/payments.md`~~ — **Resolved:** payments out of platform scope.
2. Add deployment notes (Helm primary, operator secondary) — see [implementation-plans/](./implementation-plans/).
3. Add **CLI GitOps** section to `core.md` or standalone `features/gitops.md` — config/declarative export policy only.
4. Patch module docs with **MCP-disabled route tables** (database introspection stays excluded).
5. Document **Hermes MCP resources** (`conduit://docs/*`) in [platform-libs/](./platform-libs/) or `core.md`.
6. Add [platform-libs/](./platform-libs/) — Hermes, grpc-sdk, module-tools.

### Code / UI fixes (highest impact drift)
1. **Conduit-UI communications APIs** — **Resolved:** fix UI paths; no backend shims.
2. **Router proxy UI** — **Implemented:** removed in [router-proxy-cleanup.plan.md](./implementation-plans/router-proxy-cleanup.plan.md).
3. **Fix `features/chat.md`** — document existing admin routes; retract incorrect Open Question #1.
4. **Wire `UserCreateByUsername`** or remove from proto — **In plan** ([bug-fix-batch](./implementation-plans/bug-fix-batch.plan.md)).
5. **Functions cron** — **In plan:** implement scheduler.
6. **Database custom endpoint op 8** — **In plan:** fix `$contains` vs duplicate `$nin`.

### Agent / MCP hygiene
1. **Resolved:** Align skill docs with `getconfig_*` tool names.
2. Document required `?modules=` for functions; introspection stays excluded.
3. **Resolved:** Add `relations/many` and `indexer/reconstruct` to MCP skill inventory.

### Implementation tracking

See [implementation-plans/](./implementation-plans/) for batched fix and feature work (e.g. `bug-fix-batch.plan.md`).

---

## Audit metadata

| Item | Value |
|------|-------|
| First-pass docs | 9 modules + README (~5,750 lines) |
| Second-pass method | Source cross-check, Conduit-UI API clients, website v0.16/v0.17, grpc-sdk, Hermes MCP, external repos |
| Open questions consolidated | **102** across 9 modules (many now **Resolved** / **In plan** — see status tags) |
| Product decisions | [Product decisions (resolved)](#product-decisions-resolved) |
| Implementation plans | [implementation-plans/](./implementation-plans/) |
| Platform libraries docs | [platform-libs/](./platform-libs/) |
| New repos flagged | payments, operator, CLI (GitOps) |
| Critical UI/backend breaks | Communications API paths (UI stale) |
| First-pass doc errors | `features/chat.md` admin routes incorrectly marked missing; `features/functions.md` MCP section corrected |

*This file should be updated after each major platform release or when closing drift tickets.*
