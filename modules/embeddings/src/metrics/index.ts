import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  generatedEmbeddings: {
    type: MetricType.Counter,
    config: {
      name: 'generated_embeddings_total',
      help: 'Tracks the total number of generated embeddings',
    },
  },
  failedEmbeddings: {
    type: MetricType.Counter,
    config: {
      name: 'failed_embeddings_total',
      help: 'Tracks the total number of failed embedding generation attempts',
    },
  },
  malformedEmbeddingEvents: {
    type: MetricType.Counter,
    config: {
      name: 'malformed_embedding_events_total',
      help: 'Tracks malformed or oversized embedding bus payloads',
    },
  },
  malformedEmbeddingJobs: {
    type: MetricType.Counter,
    config: {
      name: 'malformed_embedding_jobs_total',
      help: 'Tracks malformed or oversized embedding queue payloads',
    },
  },
};
