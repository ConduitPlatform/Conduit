# Conduit Platform — Module Feature Catalog

Exhaustive feature and capability reference for every first-party Conduit module, generated from source code analysis (`modules/*`, `packages/core`).

## Related documentation

| Area | Location |
|------|----------|
| **Second-pass audit & resolved decisions** | [gaps-and-audit.md](./gaps-and-audit.md) — includes [Product decisions (resolved)](./gaps-and-audit.md#product-decisions-resolved) |
| **Platform libraries** (Hermes, grpc-sdk, module-tools) | [platform-libs/](./platform-libs/) |
| **Implementation plans** (bug batches, feature work) | [implementation-plans/](./implementation-plans/) |
| **Chat briefs** (one file per agent chat) | [chat-briefs/](./chat-briefs/) |

### Implementation plans

Full index with rollout order: **[implementation-plans/README.md](./implementation-plans/README.md)** (13 tracks).

| Plan | Description |
|------|-------------|
| [bug-fix-batch](./implementation-plans/bug-fix-batch.plan.md) | 11 confirmed bugs (4 PRs) |
| [conduit-ui-comms-paths](./implementation-plans/conduit-ui-comms-paths.plan.md) | Fix Conduit-UI → communications paths |
| [communications-unified-templates](./implementation-plans/communications-unified-templates.plan.md) | Unified template CRUD + orchestration |
| [functions-cron](./implementation-plans/functions-cron.plan.md) | BullMQ cron scheduler |
| [gcs-storage-rewrite](./implementation-plans/gcs-storage-rewrite.plan.md) | Rewrite GCS provider |
| [router-proxy-cleanup](./implementation-plans/router-proxy-cleanup.plan.md) | Remove proxy UI + config |
| [service-account-removal](./implementation-plans/service-account-removal.plan.md) | Remove service accounts |
| [chat-invitation-flow](./implementation-plans/chat-invitation-flow.plan.md) | Login + redirectUri + token param |
| [team-delete-sudo](./implementation-plans/team-delete-sudo.plan.md) | Team delete alignment + sudo |
| [chat-admin-delete-notifications](./implementation-plans/chat-admin-delete-notifications.plan.md) | Admin delete socket/bus events |
| [mcp-authz-routes](./implementation-plans/mcp-authz-routes.plan.md) | Expose authz bulk/index to MCP |
| [deep-readiness](./implementation-plans/deep-readiness.plan.md) | Deep readiness probe |
| [mcp-skill-naming](./implementation-plans/mcp-skill-naming.plan.md) | Align MCP skill with live `tools/list` names (likely `get_config_*`) |

## Modules

| Module | Document | Lines | Description |
|--------|----------|-------|-------------|
| **Authentication** | [authentication.md](./authentication.md) | 743 | Identity, OAuth, 2FA, teams, tokens |
| **Authorization** | [authorization.md](./authorization.md) | 480 | ReBAC relations, resources, permission checks |
| **Chat** | [chat.md](./chat.md) | 681 | Rooms, messages, real-time sockets, invitations |
| **Communications** | [communications.md](./communications.md) | 728 | Email, push notifications, SMS (unified module) |
| **Database** | [database.md](./database.md) | 728 | Schemas, CRUD, custom endpoints, indexes, CMS |
| **Functions** | [functions.md](./functions.md) | 535 | Event/webhook/socket/cron custom functions |
| **Router** | [router.md](./router.md) | 585 | Client & Admin API gateways, middleware, rate limits |
| **Storage** | [storage.md](./storage.md) | 676 | File upload/download, multi-cloud providers |
| **Core** | [core.md](./core.md) | 543 | Service discovery, admins, API tokens, config, health |

## How to read these docs

Each module document follows a consistent structure:

1. **Overview** — capabilities summary and architecture
2. **Configuration** — env vars and admin config keys
3. **Client API Routes** — end-user REST surface (`CLIENT_BASE_URL`)
4. **Admin API Routes** — operator/MCP surface (`ADMIN_BASE_URL`)
5. **gRPC Services** — inter-module RPC
6. **Data Models** — persisted schemas
7. **Integration Points** — dependencies on other modules
8. **Feature Matrix** — quick lookup table
9. **Open Questions** — ambiguities found in code (not guesses)

## Platform context

- **8 first-party microservice modules** live under `modules/`.
- Legacy standalone **email**, **sms**, and **push-notifications** modules are consolidated into **communications** (v0.17+).
- **Core** (`packages/core`) is the control plane — not a `modules/` microservice but essential for operators.
- Application runtimes should use the **Client API** only; provisioning uses **Admin API** or **Conduit MCP**.

## Second-pass audit

**[gaps-and-audit.md](./gaps-and-audit.md)** — Missed capabilities, UI/code drifts, partial implementations, and consolidated open questions from the second documentation pass. Includes **[Product decisions (resolved)](./gaps-and-audit.md#product-decisions-resolved)** (platform scope, bug-fix batch, UI/MCP policy). Undocumented repos: `conduit-operator`, CLI GitOps (`conduit-payments` is out of platform scope).

## Platform libraries

**[platform-libs/](./platform-libs/)** — Cross-cutting library documentation (Hermes, grpc-sdk, module-tools).

| Library | Document | Description |
|---------|----------|-------------|
| **Index** | [platform-libs/README.md](./platform-libs/README.md) | Overview, dependency graph, when to use which library |
| **Hermes** | [platform-libs/hermes.md](./platform-libs/hermes.md) | REST, GraphQL, Socket.IO, MCP routing framework |
| **grpc-sdk** | [platform-libs/grpc-sdk.md](./platform-libs/grpc-sdk.md) | Inter-module gRPC client SDK, event bus, types |
| **module-tools** | [platform-libs/module-tools.md](./platform-libs/module-tools.md) | `ManagedModule` base class, routing, gRPC server |

## Chat briefs (agent execution pack)

**[chat-briefs/](./chat-briefs/)** — **27 handoff files** (16 code + 11 docs): one per Cursor chat. Master index: [chat-briefs/README.md](./chat-briefs/README.md).

```text
Read and execute: @features/chat-briefs/<filename>.md
```

## Implementation plans

**[implementation-plans/](./implementation-plans/)** — Batched implementation and bug-fix plans. See the [implementation plans table](#implementation-plans) above for individual plan links.

## Cross-cutting open questions

Several modules flag inconsistencies between code, UI, and docs. See the **Open Questions** section in each file, or the consolidated list in **[gaps-and-audit.md](./gaps-and-audit.md)**. Notable themes:

- Admin vs client route parity (chat, authorization)
- Config keys defined but not wired (communications retry metrics)
- gRPC/proto RPCs declared but not registered (authentication, communications templates)
- Planned features with partial implementation (functions cron, database vector search **deferred**)
