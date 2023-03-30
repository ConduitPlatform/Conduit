import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  path: {
    type: TYPE.String,
    required: true,
  },
  action: {
    type: TYPE.String,
    required: true,
  },
  middleware: {
    type: TYPE.String,
    required: true,
    unique: true,
  },
  position: {
    type: TYPE.Number,
    required: true,
  },
  owner: {
    type: TYPE.String,
    required: true,
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

export class AppMiddleware extends ConduitActiveSchema<AppMiddleware> {
  private static _instance: AppMiddleware;
  _id!: string;
  path!: string;
  action!: string;
  middleware!: string;
  position!: number;
  owner!: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, AppMiddleware.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (AppMiddleware._instance) return AppMiddleware._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    AppMiddleware._instance = new AppMiddleware(database);
    return AppMiddleware._instance;
  }
}
