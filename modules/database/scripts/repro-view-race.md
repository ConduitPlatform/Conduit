# Reproduce MongoDB authorization view creation race

This documents how to verify the fix for concurrent `createView` calls that previously caused:

```text
Cannot overwrite … model once compiled.
```

## Prerequisites

- MongoDB reachable via `DB_CONN_URI`
- Redis reachable (same config as Conduit core / database module event bus)
- Two database module replicas (or scale database deployment to 2)

## Automated checks (local)

From repo root after building:

```bash
pnpm --filter @conduitplatform/grpc-sdk test
pnpm --filter @conduitplatform/database build
```

## Integration repro (two database instances)

1. Deploy/start Conduit with **two database instances** sharing the same MongoDB and Redis.
2. Enable authorization and use a schema with `authorization.enabled: true`.
3. Trigger concurrent `CreateResourceAccessList` / authorized reads for the same `(subject, action, objectType)` so they resolve to the same hashed `viewName`.
4. Confirm:
   - No `OverwriteModelError` / `Cannot overwrite … model` in database logs
   - No `NamespaceExists` errors surfaced to callers
   - One MongoDB view namespace for the hashed name
   - One `Views` metadata document for that name
   - Both database instances can serve authorized reads through the view

## What the fix does

- Same-process callers coalesce on one in-flight promise per `viewName`
- Cross-instance callers serialize on a Redis Redlock keyed per view
- After waiting, callers re-check local/durable state instead of assuming the lock holder succeeded
- Physical MongoDB view creation is separated from local Mongoose model registration
