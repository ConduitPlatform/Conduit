import { ProxyOptions, ProxyRouteActions } from './IProxyRouteOptions';

export type ProxyRouteT = {
  options: {
    path: string;
    action: ProxyRouteActions;
    middlewares?: string[];
    description?: string;
  };
  proxy: ProxyOptions;
};
