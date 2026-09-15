# Database Module

## Vector Search

Conduit supports provider-neutral vector storage and search through `TYPE.Vector`,
vector index contracts, and the Database gRPC/admin vector APIs.

### Schema Field

```ts
{
  embedding: {
    type: TYPE.Vector,
    dimensions: 1536,
    similarity: VectorSimilarity.Cosine,
    select: false,
  },
}
```

### Capabilities

Use `getVectorCapabilities` before creating indexes or running searches. Capability
responses distinguish storage support from index/search support:

- MongoDB stores vectors as numeric arrays and uses MongoDB Search/Vector Search
  indexes when `createSearchIndex` and `listSearchIndexes` are available.
- PostgreSQL uses `pgvector`; the adapter attempts `CREATE EXTENSION IF NOT EXISTS
  vector` during startup and reports missing privileges or extension support through
  capabilities.
- Other Sequelize dialects report vector search as unsupported.

### Rollout

1. Add a `TYPE.Vector` field to the schema or via the Embeddings module schema
   extension.
2. Call `getVectorCapabilities` and verify `indexing` and `search` are true.
3. Create a vector index with the field, dimensions, similarity, and optional
   filter fields.
4. Backfill embeddings.
5. Run `vectorSearch` with a query vector.

The Embeddings module is a separate opt-in image (not standalone v1). See
[deploy/embeddings.md](../../deploy/embeddings.md) before enabling generation
or search. Live Atlas/pgvector validation is an operator runbook step, not CI.

CMS create/update bodies omit `TYPE.Vector` fields, `*SourceHash` fields, and
any `select: false` field so clients cannot write managed embeddings. Read/return
projections still include those schema fields.
