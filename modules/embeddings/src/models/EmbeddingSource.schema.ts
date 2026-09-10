import {
  ConduitModel,
  DatabaseProvider,
  TYPE,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import {
  EMBEDDING_SOURCE_KINDS,
  EMBEDDING_SOURCE_SCHEMA,
  EMBEDDING_SOURCE_STATES,
  type EmbeddingSourceKind,
  type EmbeddingSourceState,
} from '../utils/genericSource.js';

export const embeddingSourceFields: ConduitModel = {
  _id: TYPE.ObjectId,
  label: { type: TYPE.String, required: false },
  kind: {
    type: TYPE.String,
    enum: [...EMBEDDING_SOURCE_KINDS],
    required: true,
  },
  state: {
    type: TYPE.String,
    enum: [...EMBEDDING_SOURCE_STATES],
    required: true,
    default: 'pending',
  },
  partitionSubject: { type: TYPE.String, required: true },
  provider: { type: TYPE.String, required: true },
  modelName: { type: TYPE.String, required: true },
  dimensions: { type: TYPE.Number, required: true },
  similarity: {
    type: TYPE.String,
    enum: Object.values(VectorSimilarity),
    default: VectorSimilarity.Cosine,
  },
  selectors: { type: TYPE.JSON, required: false },
  metadataAllowlist: { type: [TYPE.String], required: false },
  syncCheckpoint: { type: TYPE.JSON, required: false },
  chunkSchemaName: { type: TYPE.String, required: false },
  chunkIndexName: { type: TYPE.String, required: false },
  chunkIndexStatus: { type: TYPE.String, required: false },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};

export const embeddingSourceModelOptions = {
  timestamps: true,
  indexes: [
    { fields: ['kind', 'partitionSubject', 'state'] },
    { fields: ['chunkSchemaName'] },
    { fields: ['provider', 'modelName', 'dimensions', 'similarity'] },
  ],
  conduit: {
    cms: { enabled: false },
    permissions: {
      extendable: false,
      canCreate: false,
      canModify: 'Nothing',
      canDelete: false,
    },
    authorization: { enabled: true },
  },
} as const;

export class EmbeddingSource extends ConduitActiveSchema<EmbeddingSource> {
  private static _instance: EmbeddingSource;
  _id: string;
  label?: string;
  kind: EmbeddingSourceKind;
  state: EmbeddingSourceState;
  partitionSubject: string;
  provider: string;
  modelName: string;
  dimensions: number;
  similarity: VectorSimilarity;
  selectors?: Record<string, unknown>;
  metadataAllowlist?: string[];
  syncCheckpoint?: Record<string, unknown>;
  chunkSchemaName?: string;
  chunkIndexName?: string;
  chunkIndexStatus?: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(
      database,
      EMBEDDING_SOURCE_SCHEMA,
      embeddingSourceFields,
      embeddingSourceModelOptions,
    );
  }

  static getInstance(database?: DatabaseProvider) {
    if (EmbeddingSource._instance) return EmbeddingSource._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    EmbeddingSource._instance = new EmbeddingSource(database);
    return EmbeddingSource._instance;
  }
}
