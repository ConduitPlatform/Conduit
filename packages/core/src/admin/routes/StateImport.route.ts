import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitJson } from '@conduitplatform/module-tools';
import { ConduitRoute } from '@conduitplatform/hermes';
import AdminModule from '../AdminModule.js';

type ModuleImportClient = {
  getExportableResources: (req: object) => Promise<{ resources: string }>;
  importResources: (req: { data: string }) => Promise<{ result: string }>;
};

interface StateImportBody {
  configs?: { modules: Record<string, object> };
  modules?: Record<string, Record<string, unknown[]>>;
}

export function getStateImportRoute(admin: AdminModule) {
  const { grpcSdk, configManager } = admin;
  return new ConduitRoute(
    {
      path: '/state/import',
      action: ConduitRouteActions.POST,
      description:
        'Imports full Conduit state: applies configs first, then module resources in priority order.',
      bodyParams: {
        configs: { type: TYPE.JSON, required: false },
        modules: { type: TYPE.JSON, required: false },
      },
    },
    new ConduitRouteReturnDefinition('StateImportRoute', {
      configResults: ConduitJson.Required,
      moduleResults: ConduitJson.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const body = (params.params ?? {}) as StateImportBody;
      const configResults: Record<string, { success: boolean; error?: string }> = {};
      const moduleResults: Record<string, Record<string, unknown>> = {};

      if (body.configs?.modules) {
        for (const [moduleName, config] of Object.entries(body.configs.modules)) {
          try {
            if (moduleName === 'core' || moduleName === 'admin') {
              if (moduleName === 'admin' && configManager.adminModule) {
                await configManager.adminModule.setConfig(config);
              }
              await configManager.set(moduleName, config);
              configResults[moduleName] = { success: true };
            } else {
              const client = grpcSdk.getModuleClient(moduleName) as any;
              if (client?.setConfig) {
                await client.setConfig({ newConfig: JSON.stringify(config) });
                await configManager.set(moduleName, config);
                configResults[moduleName] = { success: true };
              } else {
                configResults[moduleName] = {
                  success: false,
                  error: 'Module not available',
                };
              }
            }
          } catch (e) {
            configResults[moduleName] = { success: false, error: (e as Error).message };
          }
        }
      }

      if (body.modules && Object.keys(body.modules).length > 0) {
        const moduleNames = Object.keys(body.modules);
        const withPriority: { moduleName: string; priority: number }[] = [];

        for (const moduleName of moduleNames) {
          const client = grpcSdk.getModuleClient(moduleName) as unknown as
            | ModuleImportClient
            | undefined;
          if (!client?.getExportableResources || !client?.importResources) {
            moduleResults[moduleName] = { error: 'Module does not support import' };
            continue;
          }
          try {
            const res = await client.getExportableResources({});
            const resources = JSON.parse(res.resources || '[]') as {
              type: string;
              priority: number;
            }[];
            const typesInPayload = Object.keys(body.modules[moduleName] ?? {});
            const minPriority =
              resources
                .filter(r => typesInPayload.includes(r.type))
                .reduce((min, r) => Math.min(min, r.priority), Number.MAX_SAFE_INTEGER) ??
              50;
            withPriority.push({ moduleName, priority: minPriority });
          } catch (_) {
            withPriority.push({ moduleName, priority: 50 });
          }
        }

        withPriority.sort((a, b) => a.priority - b.priority);

        for (const { moduleName } of withPriority) {
          const data = body.modules[moduleName];
          if (!data) continue;
          const client = grpcSdk.getModuleClient(
            moduleName,
          ) as unknown as ModuleImportClient;
          try {
            const result = await client.importResources({ data: JSON.stringify(data) });
            moduleResults[moduleName] = JSON.parse(result.result || '{}');
          } catch (e) {
            moduleResults[moduleName] = { error: (e as Error).message };
          }
        }
      }

      return { configResults, moduleResults };
    },
  );
}
