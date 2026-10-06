import {
  ConduitModel,
  DatabaseProvider,
  Indexable,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';
import { BACKFILL_RUN_STATES, BackfillRunState } from '../utils/backfillRun.js';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  schemaName: { type: TYPE.String, required: true },
  configId: { type: TYPE.String, required: false },
  state: {
    type: TYPE.String,
    enum: [...BACKFILL_RUN_STATES],
    required: true,
    default: 'queued',
  },
  cursor: { type: TYPE.String, required: false },
  batchSize: { type: TYPE.Number, required: true },
  onlyMissing: { type: TYPE.Boolean, default: false },
  filter: { type: TYPE.JSON, required: false },
  scannedCount: { type: TYPE.Number, default: 0 },
  queuedCount: { type: TYPE.Number, default: 0 },
  processedCount: { type: TYPE.Number, default: 0 },
  failedCount: { type: TYPE.Number, default: 0 },
  startedAt: { type: TYPE.Date, required: false },
  finishedAt: { type: TYPE.Date, required: false },
  drainStartedAt: { type: TYPE.Date, required: false },
  error: { type: TYPE.String, required: false },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};

const modelOptions = {
  timestamps: true,
  indexes: [{ fields: ['schemaName', 'state'] }, { fields: ['configId', 'state'] }],
  conduit: {
    permissions: {
      extendable: false,
      canCreate: false,
      canModify: 'Nothing',
      canDelete: false,
    },
  },
} as const;

export class BackfillRun extends ConduitActiveSchema<BackfillRun> {
  private static _instance: BackfillRun;
  _id: string;
  schemaName: string;
  configId?: string;
  state: BackfillRunState;
  cursor?: string;
  batchSize: number;
  onlyMissing: boolean;
  filter?: Indexable;
  scannedCount: number;
  queuedCount: number;
  processedCount: number;
  failedCount: number;
  startedAt?: Date;
  finishedAt?: Date;
  drainStartedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, BackfillRun.name, schema, modelOptions);
  }

  static getInstance(database?: DatabaseProvider) {
    if (BackfillRun._instance) return BackfillRun._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    BackfillRun._instance = new BackfillRun(database);
    return BackfillRun._instance;
  }
}
