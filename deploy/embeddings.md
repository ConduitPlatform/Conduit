# Embeddings rollout and rollback

Embeddings is a separate, disabled-by-default module image. It is not part of
standalone v1. Live MongoDB Atlas, pgvector, Redis, and provider suites are
**not** covered by CI; operators must complete the capability and index
readiness checks below before enabling generation or search.

Production containers set `NODE_ENV=production` and **require `GRPC_KEY`**.
The module stays disabled (`enabled: false`) until an operator enables it
through Core config after peer health and vector capabilities are confirmed.

## Compose (opt-in)

```bash
# Set GRPC_KEY in docker/.env before starting embeddings.
docker compose --profile mongodb --profile embeddings up
```

- gRPC: `55165` (`EMBEDDINGS_GRPC_PORT`)
- Metrics: `9192` (Prometheus scrapes `conduit-embeddings:9192`)
- Image: `docker.io/conduitplatform/embeddings:${IMAGE_TAG}`

Helm values (`install.embeddings`) are documented in the charts repository
and remain disabled by default.

## Rollout order

1. Release compatible Core, Database, grpc-sdk, and the embeddings image.
2. Deploy embeddings **disabled**. Confirm the process is serving and waiting
   on / registered with Core. Health stays serving while disabled so operators
   can configure the module.
3. Set `GRPC_KEY` (required in production). Confirm gRPC peer health.
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
9. Enable workers/search for normal traffic (`enabled: true` on module config).

## Rollback

1. Disable workers and embedding configs (`enabled: false`). Generation and
   search stop; existing vectors remain.
2. Scale down or stop the embeddings service:
   - Compose: omit `--profile embeddings` / `docker compose stop embeddings`
   - Helm: `install.embeddings: false` (charts repo)
3. Roll back the embeddings image and/or chart to the previous version.
4. Do **not** automatically delete vector fields, indexes, `EmbeddingConfig`
   documents, `BackfillRun` records, or Redis/BullMQ state. Data and index
   removal is a separate explicit operator action.

## Residual validation

Offline CI covers unit/contract tests, bundle smoke (`Waiting for Core`),
image target discovery, and compose rendering. It does not prove Atlas,
pgvector, Redis queue behavior, or a live provider. Repeat capability and
index readiness checks in the target environment before activation.
