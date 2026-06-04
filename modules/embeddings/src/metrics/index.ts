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
};
