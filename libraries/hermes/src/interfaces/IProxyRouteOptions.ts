export enum ProxyRouteActions {
  GET = 'GET',
  POST = 'POST',
  UPDATE = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  ALL = 'ALL',
}
export interface ProxyRouteOptions {
  path: string;
  target: string;

  action?: ProxyRouteActions;

  description?: string;

  middlewares?: string[];

  // A boolean indicating whether the origin of the request should be changed.
  changeOrigin?: boolean;

  //A boolean indicating whether the connection to the target should be secure.
  secure?: boolean;
  //A string or array of strings indicating the context in which the proxy route should be applied.
  context?: string | string[];

  //An object that maps the original paths to their rewritten counterparts.
  pathRewrite?: { [path: string]: string };

  //An object that specifies custom headers to be sent to the target.
  headers?: { [name: string]: string };

  // The timeout for the proxy request, in milliseconds.
  proxyTimeout?: number;

  // An object that maps original domain names to their rewritten counterparts.
  cookieDomainRewrite?: { [hostname: string]: string };

  //A boolean indicating whether the path should automatically be rewritten.
  autoRewrite?: boolean;

  //A boolean indicating whether the proxy route should follow redirects.
  followRedirects?: boolean;

  //A boolean indicating whether the X-Forwarded-* headers should be added.
  xfwd?: boolean;

  // A boolean indicating whether the proxy route should handle WebSockets.
  ws?: boolean;
  //An object that maps paths to targets.
  router?: { [path: string]: string };

  //A boolean indicating whether the case of header keys should be preserved.
  preserveHeaderKeyCase?: boolean;
}
