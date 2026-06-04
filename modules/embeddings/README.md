# Embeddings Module

The Embeddings module owns text-to-vector generation, embedding configuration,
backfills, and semantic search by text. The Database module remains responsible
for vector storage, index creation, and vector-in/vector-out search.

## Configuration

The module is disabled by default. Enable it and configure an OpenAI-compatible
provider:

```json
{
  "enabled": true,
  "defaultProvider": "openai-compatible",
  "providers": {
    "openai-compatible": {
      "endpoint": "https://api.openai.com/v1/embeddings",
      "apiKey": "..."
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
   `provider`, `model`, and `dimensions`.
2. The module adds a vector schema extension for the target field and a source
   hash field used to skip unchanged documents.
3. Start a backfill, or rely on database create/update events to enqueue
   incremental embedding jobs.
4. Use `semanticSearch` to generate a query embedding and delegate search to the
   Database module.

Provider output dimensions must match the configured vector dimensions. Mismatches
fail before vectors are written or searched.
