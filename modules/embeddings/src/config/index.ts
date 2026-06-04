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
    doc: 'Embedding provider configuration keyed by provider name',
    format: Object,
    default: {},
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
  },
};

const config = convict(AppConfigSchema);
const configProperties = config.getProperties();
export type Config = typeof configProperties & {
  providers: Record<string, Record<string, any>>;
};
export default AppConfigSchema;
