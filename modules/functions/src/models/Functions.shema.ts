import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  name: {
    type: TYPE.String,
    required: true,
  },
  code: {
    type: TYPE.String,
    required: true,
  },
  operation: {
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

export class Functions extends ConduitActiveSchema<Functions> {
  private static _instance: Functions;
  _id!: string;
  name!: string;
  code!: string;
  operation!: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, Functions.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (Functions._instance) return Functions._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Functions._instance = new Functions(database);
    return Functions._instance;
  }
}
