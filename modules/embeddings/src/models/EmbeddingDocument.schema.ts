import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import {
  EMBEDDING_DOCUMENT_SCHEMA,
  EMBEDDING_DOCUMENT_STATES,
  type EmbeddingDocumentState,
} from '../utils/genericSource.js';

export const embeddingDocumentFields: ConduitModel = {
  _id: TYPE.ObjectId,
  sourceId: { type: TYPE.String, required: true },
  externalDocumentId: { type: TYPE.String, required: true },
  contentVersion: { type: TYPE.String, required: false },
  etag: { type: TYPE.String, required: false },
  metadata: { type: TYPE.JSON, required: false },
  storageFileId: { type: TYPE.String, required: false },
  connectorReference: { type: TYPE.String, required: false },
  mimeType: { type: TYPE.String, required: false },
  partitionSubject: { type: TYPE.String, required: true },
  status: {
    type: TYPE.String,
    enum: [...EMBEDDING_DOCUMENT_STATES],
    required: true,
    default: 'pending',
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};

export const embeddingDocumentModelOptions = {
  timestamps: true,
  indexes: [
    { fields: ['sourceId', 'externalDocumentId'], options: { unique: true } },
    { fields: ['partitionSubject', 'status'] },
    { fields: ['storageFileId'] },
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

export class EmbeddingDocument extends ConduitActiveSchema<EmbeddingDocument> {
  private static _instance: EmbeddingDocument;
  _id: string;
  sourceId: string;
  externalDocumentId: string;
  contentVersion?: string;
  etag?: string;
  metadata?: Record<string, unknown>;
  storageFileId?: string;
  connectorReference?: string;
  mimeType?: string;
  partitionSubject: string;
  status: EmbeddingDocumentState;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(
      database,
      EMBEDDING_DOCUMENT_SCHEMA,
      embeddingDocumentFields,
      embeddingDocumentModelOptions,
    );
  }

  static getInstance(database?: DatabaseProvider) {
    if (EmbeddingDocument._instance) return EmbeddingDocument._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    EmbeddingDocument._instance = new EmbeddingDocument(database);
    return EmbeddingDocument._instance;
  }
}
