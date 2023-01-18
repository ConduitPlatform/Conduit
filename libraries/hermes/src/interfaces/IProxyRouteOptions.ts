import { Request, Response } from 'express';
import { ConduitRouteActions } from '@conduitplatform/grpc-sdk';

export interface ProxyRouteOptions {
  path: string;
  target: string;

  action: ConduitRouteActions;

  middlewares?: string[];
  changeOrigin?: boolean;
  secure?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  onError?: (err: Error, req: Request, res: Response) => void;
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
}
