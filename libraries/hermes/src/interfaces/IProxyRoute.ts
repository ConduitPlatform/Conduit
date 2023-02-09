import { ProxyRouteActions } from './IProxyRouteOptions';

export type ProxyRouteT = {
  options: {
    path: string;
    action: ProxyRouteActions;
    middlewares?: string[];
    description?: string;
  };
  proxy: {
    target: string;
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
  };
};
