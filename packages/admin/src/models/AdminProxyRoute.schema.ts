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
  action: {
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
  changeOrigin: {
    type: TYPE.Boolean,
    required: false,
  },
  secure: {
    type: TYPE.Boolean,
    required: false,
  },
  context: {
    type: [TYPE.String],
    required: false,
  },
  pathRewrite: {
    type: TYPE.JSON,
    required: false,
  },
  headers: {
    type: TYPE.JSON,
    required: false,
  },
  proxyTimeout: {
    type: TYPE.Number,
    required: false,
  },
  cookieDomainRewrite: {
    type: TYPE.JSON,
    required: false,
  },
  autoRewrite: {
    type: TYPE.Boolean,
    required: false,
  },
  followRedirects: {
    type: TYPE.Boolean,
    required: false,
  },
  xfwd: {
    type: TYPE.Boolean,
    required: false,
  },
  ws: {
    type: TYPE.Boolean,
    required: false,
  },
  router: {
    type: TYPE.JSON,
    required: false,
  },
  preserveHeaderKeyCase: {
    type: TYPE.Boolean,
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

export class AdminProxyRoute extends ConduitActiveSchema<AdminProxyRoute> {
  private static _instance: AdminProxyRoute;
  _id!: string;
  path!: string;
  target!: string;
  action?: string;

  description?: string;

  middlewares?: string[];
  changeOrigin?: boolean;
  secure?: boolean;
  context?: string | string[];
  pathRewrite?: { [path: string]: string };
  headers?: { [name: string]: string };
  proxyTimeout?: number;
  cookieDomainRewrite?: { [hostname: string]: string };
  autoRewrite?: boolean;
  followRedirects?: boolean;
  xfwd?: boolean;
  ws?: boolean;
  router?: { [path: string]: string };
  preserveHeaderKeyCase?: boolean;
  createdAt!: Date;
  updatedAt!: Date;
  private constructor(database: DatabaseProvider) {
    super(database, AdminProxyRoute.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (AdminProxyRoute._instance) return AdminProxyRoute._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    AdminProxyRoute._instance = new AdminProxyRoute(database);
    return AdminProxyRoute._instance;
  }
}
