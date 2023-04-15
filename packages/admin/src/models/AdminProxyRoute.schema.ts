import { DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { IProxyMiddlewareOptions } from '../interfaces ';
import { ProxyRouteActions } from '@conduitplatform/hermes';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

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
  middlewares: [TYPE.String],
  proxyMiddlewareOptions: {
    type: TYPE.JSON,
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
  action!: ProxyRouteActions;

  description?: string;

  middlewares?: string[];

  proxyMiddlewareOptions?: IProxyMiddlewareOptions;

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
