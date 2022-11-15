import { RegisterModuleRequest_ConduitManifest as ConduitManifest } from '@conduitplatform/commons';

export type ServiceDiscoveryModuleEntry = {
  manifest: ConduitManifest;
  instance: string;
  url: string;
  configSchema?: object;
};

export type ServiceDiscoveryState = {
  modules: ServiceDiscoveryModuleEntry[];
};
