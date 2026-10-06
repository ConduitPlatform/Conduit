import {
  ConduitModel,
  DatabaseProvider,
  TYPE,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  schemaName: { type: TYPE.String, required: true },
  sourceFields: { type: [TYPE.String], required: true },
  targetField: { type: TYPE.String, required: true },
  provider: { type: TYPE.String, required: true },
  modelName: { type: TYPE.String, required: true },
  dimensions: { type: TYPE.Number, required: true },
  similarity: {
    type: TYPE.String,
    enum: Object.values(VectorSimilarity),
    default: VectorSimilarity.Cosine,
  },
  enabled: { type: TYPE.Boolean, default: true },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};

const modelOptions = {
  timestamps: true,
  indexes: [{ fields: ['schemaName', 'targetField'], options: { unique: true } }],
  conduit: {
    permissions: {
      extendable: false,
      canCreate: false,
      canModify: 'Nothing',
      canDelete: false,
    },
  },
} as const;

export class EmbeddingConfig extends ConduitActiveSchema<EmbeddingConfig> {
  private static _instance: EmbeddingConfig;
  _id: string;
  schemaName: string;
  sourceFields: string[];
  targetField: string;
  provider: string;
  modelName: string;
  dimensions: number;
  similarity: VectorSimilarity;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, EmbeddingConfig.name, schema, modelOptions);
  }

  static getInstance(database?: DatabaseProvider) {
    if (EmbeddingConfig._instance) return EmbeddingConfig._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    EmbeddingConfig._instance = new EmbeddingConfig(database);
    return EmbeddingConfig._instance;
  }
}
