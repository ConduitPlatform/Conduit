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
  name: {
    type: TYPE.String,
    required: true,
  },
  description: {
    type: TYPE.String,
    required: false,
  },
  handler: {
    type: TYPE.String,
    required: true,
  },
  position: {
    type: TYPE.Number,
    required: true,
  },
  module: {
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

export class AdminMiddleware extends ConduitActiveSchema<AdminMiddleware> {
  private static _instance: AdminMiddleware;
  _id!: string;
  path!: string;
  action!: string;
  name!: string;
  description: string | undefined;
  handler!: string;
  position!: number;
  module!: string;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, AdminMiddleware.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (AdminMiddleware._instance) return AdminMiddleware._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    AdminMiddleware._instance = new AdminMiddleware(database);
    return AdminMiddleware._instance;
  }
}
