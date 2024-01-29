import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitJson } from '@conduitplatform/module-tools';
import { ConduitRoute } from '@conduitplatform/hermes';
import { ServiceRegistry } from '../../service-discovery/ServiceRegistry.js';

export function getMonoConfigRoute(grpcSdk: ConduitGrpcSdk) {
  return new ConduitRoute(
    {
      path: '/config',
      action: ConduitRouteActions.GET,
      description:
        'Returns a monolithic configuration object for currently registered modules.',
    },
    new ConduitRouteReturnDefinition('GetMonoConfigRoute', {
      config: ConduitJson.Required,
    }),
    async () => {
      const monoConfig: { modules: { [moduleName: string]: object } } = { modules: {} };
      const sortedModules = [
        'core',
        'admin',
        ...ServiceRegistry.getInstance().getRegisteredModules(),
      ].sort();
      for (const moduleName of sortedModules) {
        const moduleConfig = await grpcSdk.state!.getKey(`moduleConfigs.${moduleName}`);
        if (moduleConfig) monoConfig.modules[moduleName] = JSON.parse(moduleConfig);
      }
      return { config: monoConfig };
    },
  );
}
