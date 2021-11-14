import {
  ConduitActiveSchema,
  DatabaseProvider,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
    systemRequired: true,
  },
  folder: {
    type: TYPE.String,
    systemRequired: true,
  },
  container: {
    type: TYPE.String,
    required: true,
    systemRequired: true,
  },
  isPublic: {
    type: TYPE.Boolean,
    default: false,
  },
  url: TYPE.String,
  mimeType: { type: TYPE.String, systemRequired: true },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions = {
  timestamps: true,
  systemRequired: true,
};
const collectionName = undefined;

export class File extends ConduitActiveSchema<File> {
  private static _instance: File;
  _id!: string;
  name!: string;
  folder!: string;
  container!: string;
  isPublic!: boolean;
  url!: string;
  mimeType!: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, File.name, schema, schemaOptions, collectionName);
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
