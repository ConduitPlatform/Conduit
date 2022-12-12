import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: TYPE.String,
  version: TYPE.String,
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

export class Version extends ConduitActiveSchema<Version> {
  private static _instance: Version;
  _id: string;
  name: string;
  version: string;

  private constructor(database: DatabaseProvider) {
    super(database, Version.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Version._instance) return Version._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Version._instance = new Version(database);
    return Version._instance;
  }
}
