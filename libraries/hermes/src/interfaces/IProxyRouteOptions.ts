export enum ProxyRouteActions {
  GET = 'GET',
  POST = 'POST',
  UPDATE = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  ALL = 'ALL',
}

export interface HttpProxyMiddlewareOptions {
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
}

export interface ProxyRouteOptions {
  options: {
    path: string;
    action?: ProxyRouteActions;
    description?: string;
    middlewares?: string[];
  };
  proxy: ProxyOptions;
}

export interface ProxyOptions extends HttpProxyMiddlewareOptions {
  target: string;
}
