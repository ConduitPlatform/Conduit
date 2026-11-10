import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  container: {
    type: TYPE.String,
    required: true,
    unique: true,
  },
  status: {
    type: TYPE.String,
    required: true,
  },
  appliedHost: {
    type: TYPE.String,
    required: false,
  },
  targetHost: {
    type: TYPE.String,
    required: false,
  },
  checkpointId: {
    type: TYPE.String,
    required: false,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const modelOptions = {
  timestamps: true,
  conduit: {
    permissions: {
      extendable: false,
      canCreate: false,
      canModify: 'ExtensionOnly',
      canDelete: false,
    },
  },
} as const;
const collectionName = undefined;

/**
 * Named apart from the `_StorageCdnState` an earlier build of this branch
 * created. That one has a NOT NULL `fence` column which SQL sync never drops
 * (alter with drop: false), so reusing the name would make every insert fail.
 * A new name starts from an empty table or collection; the old one is orphaned
 * and the only cost is one rescan that writes no already-correct rows.
 */
export class _StorageCdnHostState extends ConduitActiveSchema<_StorageCdnHostState> {
  private static _instance: _StorageCdnHostState;
  _id!: string;
  container!: string;
  status!: string;
  appliedHost?: string;
  targetHost?: string;
  checkpointId?: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, _StorageCdnHostState.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (_StorageCdnHostState._instance) return _StorageCdnHostState._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    _StorageCdnHostState._instance = new _StorageCdnHostState(database);
    return _StorageCdnHostState._instance;
  }
}
