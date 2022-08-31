import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
    unique: true,
  },
  isPublic: {
    type: TYPE.Boolean,
    default: false,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const modelOptions = {
  timestamps: true,
  conduit: {
    permissions: {
      extendable: true,
      canCreate: false,
      canModify: 'ExtensionOnly',
      canDelete: false,
    },
  },
} as const;
const collectionName = undefined;

export class _StorageContainer extends ConduitActiveSchema<_StorageContainer> {
  private static _instance: _StorageContainer;
  _id!: string;
  name!: string;
  isPublic?: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, _StorageContainer.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (_StorageContainer._instance) return _StorageContainer._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    _StorageContainer._instance = new _StorageContainer(database);
    return _StorageContainer._instance;
  }
}
