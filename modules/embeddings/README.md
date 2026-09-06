# Embeddings Module

The Embeddings module owns text-to-vector generation, embedding configuration,
backfills, and semantic search by text. The Database module remains responsible
for vector storage, index creation, and vector-in/vector-out search.

## Configuration

The module convict `enabled` setting is `false` by default. Production
deployments require a non-empty `GRPC_KEY` (`NODE_ENV=production` in the
image). The module is **not** included in the standalone image for the first
production release; run it as a separate opt-in compose profile or Helm
workload after a compatible image tag is published. Helm
`install.embeddings.enabled` only deploys the process; it does not set convict
`enabled`.

Enable it and configure an OpenAI-compatible provider:

```json
{
  "enabled": true,
  "defaultProvider": "openai-compatible",
  "providers": {
    "openai-compatible": {
      "endpoint": "https://api.openai.com/v1/embeddings",
      "apiKey": "...",
      "allowedHosts": ["api.openai.com"]
    }
  },
  "queue": {
    "concurrency": 2,
    "attempts": 3
  }
}
```

## Workflow

1. Create an embedding config with `schemaName`, `sourceFields`, `targetField`,
   `provider`, `model`, and `dimensions`. The first upsert provisions the vector
   index when Database indexing is available. The config stays disabled until
   Database reports a queryable index. If indexing is unavailable, status
   returns a manual index lifecycle warning.
2. The module adds a vector schema extension for the target field and a source
   hash field used to skip unchanged documents.
3. Start a backfill, or rely on database create/update events to enqueue
   incremental embedding jobs. Backfills persist `BackfillRun` state and can be
   canceled or resumed from the stored cursor.
4. Use `semanticSearch` to generate a query embedding and delegate search to the
   Database module.

Provider output dimensions must match the configured vector dimensions. Mismatches
fail before vectors are written or searched.

## Admin and MCP

Operator-only Admin routes are registered under `/embeddings/*` and become MCP
tools through Hermes:

- `GET /embeddings/configs`
- `POST /embeddings/configs`
- `GET /embeddings/capabilities`
- `GET /embeddings/status`
- `POST /embeddings/backfills`
- `POST /embeddings/backfills/:id/cancel`
- `POST /embeddings/backfills/:id/resume`
- `POST /embeddings/search`

Config and backfill APIs are never exposed as client routes. Client
`POST /embeddings/search` accepts text only and takes user/scope from the
authenticated router context.

## Packaging

- Bake target: `embeddings` (BullMQ is an extra bundle dependency). The image
  is not published until a compatible release; do not pull
  `docker.io/conduitplatform/embeddings:latest` until that tag exists.
- Compose: export a non-empty `GRPC_KEY`, then
  `docker compose --profile embeddings up` (gRPC
  `${EMBEDDINGS_GRPC_PORT:-55165}`, metrics `9192`).
- Standalone v1 does not ship embeddings.
- Helm `install.embeddings.enabled` (charts repo) deploys the workload only.
  Module convict `enabled` (default false) is a separate Core config switch
  for workers and search.

Operator rollout, capability/index readiness, and rollback:
[deploy/embeddings.md](../../deploy/embeddings.md).

Live Atlas/pgvector/provider behavior is not covered by CI. Repeat the
capability and index checks in the target environment before activation.
