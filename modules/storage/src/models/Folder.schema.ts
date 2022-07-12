import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
  },
  container: {
    type: TYPE.String,
    required: true,
  },
  isPublic: {
    type: TYPE.Boolean,
    default: false,
  },
  url: TYPE.String,
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
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
const collectionName = 'cnd_folders';

export class _StorageFolder extends ConduitActiveSchema<_StorageFolder> {
  private static _instance: _StorageFolder;
  _id!: string;
  name!: string;
  container!: string;
  isPublic?: boolean;
  url!: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, _StorageFolder.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (_StorageFolder._instance) return _StorageFolder._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    _StorageFolder._instance = new _StorageFolder(database);
    return _StorageFolder._instance;
  }
}
