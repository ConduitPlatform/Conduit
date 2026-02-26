import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitJson } from '@conduitplatform/module-tools';
import { ConduitRoute } from '@conduitplatform/hermes';

type SetConfig = (config: { newConfig: string }) => Promise<{ updatedConfig: string }>;
type ModuleConfigClient = { setConfig: SetConfig };

export function getConfigImportRoute(grpcSdk: ConduitGrpcSdk, configManager: any) {
  return new ConduitRoute(
    {
      path: '/config/import',
      action: ConduitRouteActions.POST,
      description:
        'Imports module configs in bulk. Same shape as GET /config (config.modules).',
      bodyParams: {
        config: { type: 'Object', required: true },
      },
    },
    new ConduitRouteReturnDefinition('ConfigImportRoute', {
      results: ConduitJson.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const config = params.params?.config as
        | { modules?: Record<string, object> }
        | undefined;
      const modules = config?.modules ?? {};
      const results: Record<string, { success: boolean; error?: string }> = {};

      for (const [moduleName, moduleConfig] of Object.entries(modules)) {
        try {
          if (moduleName === 'core') {
            results[moduleName] = {
              success: false,
              error: 'Core config import not supported via this route',
            };
            continue;
          }
          if (moduleName === 'admin') {
            await configManager.adminModule?.setConfig(moduleConfig);
            await configManager.set(moduleName, moduleConfig);
            results[moduleName] = { success: true };
            continue;
          }
          const client = grpcSdk.getModuleClient(moduleName) as unknown as
            | ModuleConfigClient
            | undefined;
          if (!client?.setConfig) {
            results[moduleName] = { success: false, error: 'Module not available' };
            continue;
          }
          await client.setConfig({ newConfig: JSON.stringify(moduleConfig) });
          await configManager.set(moduleName, moduleConfig);
          results[moduleName] = { success: true };
        } catch (e) {
          results[moduleName] = { success: false, error: (e as Error).message };
        }
      }

      return { results };
    },
  );
}
