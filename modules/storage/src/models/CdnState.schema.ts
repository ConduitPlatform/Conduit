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

export class _StorageCdnState extends ConduitActiveSchema<_StorageCdnState> {
  private static _instance: _StorageCdnState;
  _id!: string;
  container!: string;
  status!: string;
  appliedHost?: string;
  targetHost?: string;
  checkpointId?: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, _StorageCdnState.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (_StorageCdnState._instance) return _StorageCdnState._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    _StorageCdnState._instance = new _StorageCdnState(database);
    return _StorageCdnState._instance;
  }
}
