export interface ConduitProxyOptions {
  path: string;
  target: string;
  name?: string;
  description?: string;
  middlewares?: string[];
}

export interface ConduitProxy {
  options: ConduitProxyOptions;
}
