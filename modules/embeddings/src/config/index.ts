import convict from 'convict';

const AppConfigSchema = {
  doc: 'Embeddings module configuration',
  enabled: {
    doc: 'Enable embedding generation workers and event subscriptions',
    format: 'Boolean',
    default: false,
  },
  defaultProvider: {
    doc: 'Default embedding provider',
    format: 'String',
    default: 'openai-compatible',
  },
  providers: {
    'openai-compatible': {
      endpoint: {
        doc: 'HTTPS embedding provider endpoint',
        format: String,
        default: '',
      },
      apiKey: {
        doc: 'Provider API key',
        format: String,
        default: '',
        sensitive: true,
      },
      models: {
        doc: 'Operator-managed embedding models and output dimensions',
        format: Array,
        default: [],
      },
      defaultModel: {
        doc: 'Default model name from the provider catalogue',
        format: String,
        default: '',
      },
    },
  },
  queue: {
    concurrency: {
      doc: 'Embedding generation worker concurrency',
      format: 'Number',
      default: 2,
    },
    attempts: {
      doc: 'Embedding generation retry attempts',
      format: 'Number',
      default: 3,
    },
    maxBatchSize: {
      doc: 'Maximum jobs accepted from a single enqueue or backfill request',
      format: 'Number',
      default: 500,
    },
    drainTimeoutMs: {
      doc: 'Maximum time a backfill may wait for generation jobs during drain before failing',
      format: 'Number',
      default: 15 * 60 * 1000,
    },
  },
  security: {
    sourceFieldAllowlist: {
      doc: 'Operator-configured source fields allowed even when hidden or sensitive-named. Caller-supplied allowlists are honored only for platform-admin upserts.',
      format: Array,
      default: [],
    },
    maxMutationEventIds: {
      doc: 'Maximum document ids accepted from a single mutation bus payload',
      format: 'Number',
      default: 500,
    },
    embedTimeoutMs: {
      doc: 'Provider request timeout in milliseconds',
      format: 'Number',
      default: 10_000,
    },
    maxEmbedInputBytes: {
      doc: 'Maximum embedding input payload size in bytes',
      format: 'Number',
      default: 32 * 1024,
    },
    maxEmbedResponseBytes: {
      doc: 'Maximum embedding provider response size in bytes',
      format: 'Number',
      default: 1024 * 1024,
    },
    trustedIngestModules: {
      doc: 'Modules allowed to call trusted generic document and chunk ingest APIs',
      format: Array,
      default: ['database', 'core', 'storage', 'embeddings'],
    },
    maxIngestBatchSize: {
      doc: 'Maximum chunks accepted in a single document sync',
      format: 'Number',
      default: 100,
    },
    maxChunksPerDocument: {
      doc: 'Maximum persisted chunks per generic embedding document',
      format: 'Number',
      default: 256,
    },
    maxChunkTextBytes: {
      doc: 'Maximum UTF-8 bytes of transient chunk text accepted for embedding',
      format: 'Number',
      default: 32 * 1024,
    },
    maxMetadataBytes: {
      doc: 'Maximum JSON bytes of persisted generic metadata',
      format: 'Number',
      default: 4 * 1024,
    },
    maxReferenceBytes: {
      doc: 'Maximum bytes of a storage or connector reference',
      format: 'Number',
      default: 1024,
    },
    sourceSearchMaxLimit: {
      doc: 'Maximum hits returned from generic source search',
      format: 'Number',
      default: 100,
    },
  },
  storageExtraction: {
    maxFileBytes: {
      doc: 'Maximum Storage file size accepted for automatic extraction',
      format: 'Number',
      default: 8 * 1024 * 1024,
    },
    maxExtractedBytes: {
      doc: 'Maximum UTF-8 bytes extracted from a single Storage file',
      format: 'Number',
      default: 2 * 1024 * 1024,
    },
    maxPdfPages: {
      doc: 'Maximum PDF pages parsed during automatic extraction',
      format: 'Number',
      default: 50,
    },
    extractTimeoutMs: {
      doc: 'Timeout for a single Storage extraction job',
      format: 'Number',
      default: 15_000,
    },
    maxChunksPerFile: {
      doc: 'Maximum chunks produced from one Storage file',
      format: 'Number',
      default: 256,
    },
    chunkOverlapBytes: {
      doc: 'UTF-8 overlap copied between adjacent Storage chunks',
      format: 'Number',
      default: 256,
    },
    queueConcurrency: {
      doc: 'Storage extraction worker concurrency',
      format: 'Number',
      default: 1,
    },
    queueAttempts: {
      doc: 'Storage extraction retry attempts with exponential backoff',
      format: 'Number',
      default: 5,
    },
  },
};

const config = convict(AppConfigSchema);
void config;
export type EmbeddingProviderModel = {
  name: string;
  dimensions: number;
};
export type EmbeddingProviderSettings = {
  endpoint?: string;
  apiKey?: string;
  models?: EmbeddingProviderModel[];
  defaultModel?: string;
};
export type Config = ReturnType<typeof config.getProperties> & {
  providers: Record<string, EmbeddingProviderSettings>;
};
export default AppConfigSchema;
