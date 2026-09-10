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
5. Configure the HTTPS provider (`endpoint`, `apiKey`, and model catalogue).
   `GRPC_KEY` is supplied by the deployment (`NODE_ENV=production`), not by
   module settings. Check `GET /embeddings/status` for provider/index warnings.
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
   `BackfillRun` records, `EmbeddingSource` / `EmbeddingDocument` / chunk
   indexes, and Redis/BullMQ queue state (including `embeddings-storage-queue`).
   Data and index removal is a separate explicit operator action.

## Residual validation

Offline CI covers unit/contract tests, bundle smoke (`Waiting for Core`),
image target discovery, and compose rendering. It does not prove Atlas,
pgvector, Redis queue behavior, a live provider, or a published embeddings
image. Repeat capability and index readiness checks in the target
environment before activation. The remaining release prerequisite is
publishing the first compatible embeddings image tag.

## Environment and config

Process environment (compose/Helm):

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | production | image-set `production` | Non-empty `GRPC_KEY` is required when this is `production`. |
| `GRPC_KEY` | production | none | Shared module signing secret. Never put it in module convict settings. |
| `CONDUIT_SERVER` | yes | compose `conduit:${CORE_GRPC_PORT:-55152}` | Core gRPC address. |
| `SERVICE_URL` | yes | `conduit-embeddings:${EMBEDDINGS_GRPC_PORT:-55165}` | Advertised gRPC address. |
| `GRPC_PORT` / `EMBEDDINGS_GRPC_PORT` | no | `55165` | Listen port. |
| `METRICS_PORT` | no | `9192` | Prometheus scrape. |

Core convict (Admin GET/PATCH embeddings config). Positive integers are rejected at `preConfig` (`0`, negatives, and non-integers fail). `chunkOverlapBytes` may be `0`.

| Path | Default | Role |
|---|---|---|
| `enabled` | `false` | Workers, Storage subscriptions, and search. |
| `queue.concurrency` | `2` | Schema-field generation workers. |
| `queue.attempts` | `3` | Generation retries with exponential backoff. |
| `queue.maxBatchSize` | `500` | Max jobs from one enqueue or backfill page. |
| `queue.drainTimeoutMs` | `900000` | Backfill drain deadline. |
| `security.trustedIngestModules` | `database`, `core`, `storage`, `embeddings` | Modules allowed to call `syncDocument` / `deleteDocument`. Source CRUD stays `database`/`core` or platform admin. |
| `security.maxIngestBatchSize` | `100` | Chunks per document sync. |
| `security.maxChunksPerDocument` | `256` | Persisted chunks per document; also caps Storage chunking. |
| `security.maxChunkTextBytes` / `maxEmbedInputBytes` | `32768` | Transient chunk text / embed payload. |
| `security.maxMetadataBytes` | `4096` | Persisted metadata JSON. |
| `security.maxReferenceBytes` | `1024` | `storageFileId` / `connectorReference`. |
| `storageExtraction.maxFileBytes` | `8388608` | Storage gRPC read cap; enforced before allocation. |
| `storageExtraction.maxExtractedBytes` | `2097152` | Extracted UTF-8 cap. |
| `storageExtraction.maxPdfPages` | `50` | PDF page cap. |
| `storageExtraction.extractTimeoutMs` | `15000` | Per-file extraction timeout. |
| `storageExtraction.maxChunksPerFile` | `256` | Capped by `maxChunksPerDocument`. |
| `storageExtraction.chunkOverlapBytes` | `256` | Adjacent chunk overlap. |
| `storageExtraction.queueConcurrency` | `1` | `embeddings-storage-queue` workers. |
| `storageExtraction.queueAttempts` | `5` | Extraction retries with exponential backoff. |

Existing schema-field `EmbeddingConfig` documents are unchanged by generic sources. Source `kind`, `partitionSubject`, and vector profile are immutable after create.

## Generic sources, connectors, and Storage extraction

Schema-field embeddings and generic sources coexist. There is no global Storage index: create an enabled `kind=conduit-storage` source with `selectors.container` (optional `folderPrefix`, optional MIME allowlist). MIME allowlist is a subset of `text/plain`, `text/markdown`, `application/json`, `text/csv`, `application/pdf`.

Admin/MCP (never client): `GET|POST /embeddings/sources`, `GET|PATCH|DELETE /embeddings/sources/:id`, disable/revoke, `GET /embeddings/sources/:id/status`, `POST /embeddings/sources/:id/reconcile`, trusted `POST /embeddings/sources/:id/documents`. Client search stays `POST /embeddings/search` with query text only.

**Trusted boundary:** `syncDocument` / `deleteDocument` require `security.trustedIngestModules` (or platform admin). Source management is platform admin or `database`/`core`. Embeddings itself is a trusted ingest caller for Storage extraction. Client routes never expose configs, backfills, status, or sources. Presigned URLs and `sourceUrl` are never fetched; bytes come only from authenticated Storage gRPC `GetFileBytes`.

**No-text retention:** extracted and submitted chunk text is embedded then discarded. Persisted records keep vectors, `contentHash`, `storageFileId`, and allowlisted metadata. `text` / `content` fields are forbidden on chunk schemas.

**Unsupported:** Office (doc/docx/xls/ppt and OLE), archives, encrypted PDFs, OCR/images, and MIME mismatches are skipped or failed on the automatic Storage path. Connectors that need those formats must extract text themselves and call trusted `syncDocument` on an `external` source.

**PDF / bundle:** `pdfjs-dist` (legacy build) runs in a worker thread. It is an extra embeddings bundle dependency (~4–8MB) listed in `service-bundle.config.json`. Storage is a watched optional peer, not an await peer; extraction idles if Storage is down.

## Lifecycle, reconcile, retry, and failure

1. Direct Storage create/update marks `uploadStatus=ready` and emits `storage:ready:File` / `storage:update:File`. Presigned create stays `pending` until `CompleteFileUpload` / `POST /storage/upload/:id/complete` (client) or admin/gRPC complete. Pending files are ignored. Missing `uploadStatus` is treated as ready for files that predate the lifecycle field.
2. Matching ready files enqueue `embeddings-storage-queue` with job identity `sourceId + fileId + contentVersion`. Deletes, `deleteMany` (max 500 ids), folder, and container events enqueue delete jobs even if the source is later revoked.
3. The worker reads bounded bytes, sniffs MIME, extracts, chunks, calls `syncDocument`, then drops text. `contentVersion` skips unchanged indexed files.
4. Missed events: `POST /embeddings/sources/:id/reconcile` pages matching files, enqueues ingest, and deletes stale documents. The source must be `ready`.
5. Retry: extraction uses `storageExtraction.queueAttempts` (default 5) with exponential backoff. Terminal failures increment `failed_embeddings_total` and `storage_extraction_failed_total`, mark the document `failed` with a sanitized error (no secrets, URLs, or file references in logs), and stay until reconcile or a new ready/update event. Unsupported MIME is `skipped`, not retried.
6. Watch `GET /embeddings/status` (`storageQueue`) and `GET /embeddings/sources/:id/status` (queued/extracting/indexed/skipped/failed counts). Failed queue counts and Storage-down warnings are included. Disable the source to stop ingest; revoke/purge to drop relations and data.

## Compatibility and migration

- **Legacy presigned uploads:** clients that never called complete leave `uploadStatus=pending` (or a placeholder object). Embeddings does not index those files and does not fetch the presigned URL. Complete the upload, or reconcile after completion. Pre-lifecycle File documents without `uploadStatus` are treated as ready.
- **Existing schema configs:** schema-field `EmbeddingConfig`, vector extensions, and backfills are unchanged. Generic sources use hidden `_EmbeddingChunk_*` indexes, not schema target fields.
- **Rollback** retains `EmbeddingSource` / `EmbeddingDocument` / chunk indexes and Redis `embeddings-storage-queue` state in addition to schema-field vectors, indexes, configs, and backfill records.

## Metrics, logging, and status

Prometheus (`9192`): `generated_embeddings_total`, `failed_embeddings_total`, `skipped_embeddings_total`, `retried_embeddings_total`, `embedding_backfill_jobs_total`, `malformed_embedding_events_total`, `malformed_embedding_jobs_total`, `storage_extracted_total`, `storage_skipped_total`, `storage_extraction_failed_total`. Counters have no payload labels.

Logs and persisted extraction errors run through secret/reference redaction (`apiKey`, bearer tokens, URLs, `storageFileId` / `sourceUrl` / `connectorReference`). Do not expect file paths or presigned URLs in Loki.
