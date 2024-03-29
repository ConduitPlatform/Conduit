import { ConduitModel, DatabaseProvider, TYPE } from '@conduitplatform/grpc-sdk';
import { HttpProxyMiddlewareOptions, ProxyRouteActions } from '@conduitplatform/hermes';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

const schema: ConduitModel = {
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
  routeDescription: {
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

export class RouterProxyRoute extends ConduitActiveSchema<RouterProxyRoute> {
  private static _instance: RouterProxyRoute;
  _id!: string;
  path!: string;
  target!: string;
  action!: ProxyRouteActions;
  routeDescription?: string;
  middlewares?: string[];
  proxyMiddlewareOptions?: HttpProxyMiddlewareOptions;
  createdAt!: Date;
  updatedAt!: Date;

  private constructor(database: DatabaseProvider) {
    super(database, RouterProxyRoute.name, schema, modelOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (RouterProxyRoute._instance) return RouterProxyRoute._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    RouterProxyRoute._instance = new RouterProxyRoute(database);
    return RouterProxyRoute._instance;
  }
}
