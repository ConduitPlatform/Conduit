import { ConduitActiveSchema, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';

const schema = {
  _id: TYPE.ObjectId,
  path: {
    type: TYPE.String,
    required: true,
  },
  target: {
    type: TYPE.String,
    required: true,
  },
  description: {
    type: TYPE.String,
    required: false,
  },
  middlewares: {
    type: [TYPE.String],
    required: false,
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

export class ProxyRoute extends ConduitActiveSchema<ProxyRoute> {
  private static _instance: ProxyRoute;
  _id!: string;
  path!: string;
  target!: string;

  description?: string;

  middlewares?: string[];
  createdAt!: Date;
  updatedAt!: Date;
  private constructor(database: DatabaseProvider) {
    super(database, ProxyRoute.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ProxyRoute._instance) return ProxyRoute._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ProxyRoute._instance = new ProxyRoute(database);
    return ProxyRoute._instance;
  }
}
