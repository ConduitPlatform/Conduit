import { DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
  },
  folder: {
    type: TYPE.String,
    required: true,
  },
  container: {
    type: TYPE.String,
    required: true,
  },
  size: {
    type: TYPE.Number,
    required: true,
  },
  isPublic: {
    type: TYPE.Boolean,
    default: false,
  },
  url: TYPE.String,
  mimeType: TYPE.String,
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

export class File extends ConduitActiveSchema<File> {
  private static _instance: File;
  _id!: string;
  name!: string;
  folder!: string;
  container!: string;
  size!: number;
  isPublic?: boolean;
  url!: string;
  mimeType!: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, File.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (File._instance) return File._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    File._instance = new File(database);
    return File._instance;
  }
}
