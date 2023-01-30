import {
  ConduitActiveSchema,
  DatabaseProvider,
  Indexable,
} from '@conduitplatform/grpc-sdk';

export class ProxyRoute extends ConduitActiveSchema<ProxyRoute> {
  private static _instance: ProxyRoute;
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

  constructor(database: DatabaseProvider) {
    super(database, 'ProxyRoute');
  }

  static getInstance(database?: DatabaseProvider) {
    if (ProxyRoute._instance) return ProxyRoute._instance;
    if (!database) throw new Error('Database not provided');
    ProxyRoute._instance = new ProxyRoute(database);
    return ProxyRoute._instance;
  }
}
