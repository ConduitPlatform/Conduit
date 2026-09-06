# Embeddings rollout and rollback

Embeddings is a separate, disabled-by-default module image. It is not part of
standalone v1. No embeddings image is published until a compatible release tag
exists; do not enable the compose profile or Helm workload against `latest`
until that tag is published. Live MongoDB Atlas, pgvector, Redis, and provider
suites are **not** covered by CI; operators must complete the capability and
index readiness checks below before enabling generation or search.

Production containers set `NODE_ENV=production` and **require a non-empty
`GRPC_KEY`**. Two independent enablement flags exist:

- Helm workload `install.embeddings.enabled` (charts repo, default `false`)
  only deploys or removes the embeddings process. It does not start workers.
- Module convict `enabled` (Core config, default `false`) turns on embedding
  generation workers, mutation subscriptions, and search. Keep this `false`
  until peer health and vector capabilities are confirmed.

## Compose (opt-in)

```bash
# A non-empty GRPC_KEY is required; empty values fail in production.
export GRPC_KEY='replace-with-a-non-empty-key'
docker compose --profile mongodb --profile embeddings up
```

- gRPC: `${EMBEDDINGS_GRPC_PORT:-55165}` (container `GRPC_PORT` uses the same value)
- Metrics: `9192` (Prometheus scrapes `conduit-embeddings:9192`)
- Image name after a compatible release: `docker.io/conduitplatform/embeddings:<published-tag>`.
  Compose interpolates `${IMAGE_TAG}`; that tag is not published by this change.

Helm workload `install.embeddings.enabled` is documented in the charts
repository and remains `false` by default. Setting it to `true` deploys the
pod with module convict `enabled` still false.

## Rollout order

1. Publish compatible Core, Database, grpc-sdk, **and** the embeddings image
   tag you will run. Do not start the workload before that tag exists.
2. Deploy the embeddings **workload** with convict `enabled: false`
   (`install.embeddings.enabled=true` in Helm, or the compose embeddings
   profile with a non-empty `GRPC_KEY`). Confirm the process is serving and
   waiting on / registered with Core. Health stays serving while workers are
   disabled so operators can configure the module.
3. Confirm `GRPC_KEY` is set and gRPC peer health is good.
4. Call `GET /embeddings/capabilities` (or gRPC `getCapabilities`) and verify
   Database `getVectorCapabilities`: storage, indexing, and search must be
   true for the target backend (MongoDB Atlas Vector Search or Postgres
   pgvector). Saving a disabled config may succeed with capability warnings;
   activation must not.
5. Configure the HTTPS provider (`endpoint`, `apiKey`, `allowedHosts`). Check
   `GET /embeddings/status` for provider/index warnings.
6. Create an embedding config. The first upsert provisions the vector index
   when Database indexing is available. The config stays disabled until the
   index for `targetField` is queryable (`status` ready, not pending/failed).
   If indexing is unavailable, status reports a manual lifecycle warning and
   the operator must create the index before enabling.
7. Enable the config only after index readiness. Start a **bounded** backfill
   (`onlyMissing` recommended). Watch `GET /embeddings/backfills/:id` and
   `GET /embeddings/status` queue counts. Do not scan collections in the
   request thread; backfills are queued.
8. Run a scoped canary semantic search (`POST /embeddings/search` as an
   operator, or client search with authenticated user/scope). Confirm
   fail-closed behavior on authorization-enabled schemas.
9. Enable workers/search for normal traffic (module convict `enabled: true`
   through Core config). This is not `install.embeddings.enabled`.

## Rollback

1. Disable workers and embedding configs (module convict `enabled: false`
   and per-config `enabled: false`). Generation and search stop; existing
   vectors remain.
2. Scale down or stop the embeddings **workload**:
   - Compose: omit `--profile embeddings` / `docker compose stop embeddings`
   - Helm: `install.embeddings.enabled=false` (charts repo). This is the
     workload flag, not module convict `enabled`.
3. Roll back the embeddings image and/or chart to the previous **published**
   version, if any.
4. Rollback **retains** vector fields, indexes, `EmbeddingConfig` documents,
   `BackfillRun` records, and Redis/BullMQ queue state. Data and index
   removal is a separate explicit operator action.

## Residual validation

Offline CI covers unit/contract tests, bundle smoke (`Waiting for Core`),
image target discovery, and compose rendering. It does not prove Atlas,
pgvector, Redis queue behavior, a live provider, or a published embeddings
image. Repeat capability and index readiness checks in the target
environment before activation. The remaining release prerequisite is
publishing the first compatible embeddings image tag.
