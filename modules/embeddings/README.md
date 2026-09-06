# Embeddings Module

The Embeddings module owns text-to-vector generation, embedding configuration,
backfills, and semantic search by text. The Database module remains responsible
for vector storage, index creation, and vector-in/vector-out search.

## Configuration

The module is disabled by default. Production deployments require `GRPC_KEY`
(`NODE_ENV=production` in the published image). The module is **not** included
in the standalone image for the first production release; run it as a separate
opt-in compose profile or Helm service.

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

- Bundle image: `docker.io/conduitplatform/embeddings` (BullMQ is an extra
  bundle dependency). Bake target: `embeddings`.
- Compose: `docker compose --profile embeddings up` (gRPC `55165`, metrics
  `9192`). Set `GRPC_KEY` before starting.
- Standalone v1 does not ship embeddings.

Operator rollout, capability/index readiness, and rollback:
[deploy/embeddings.md](../../deploy/embeddings.md).

Live Atlas/pgvector/provider behavior is not covered by CI. Repeat the
capability and index checks in the target environment before activation.
