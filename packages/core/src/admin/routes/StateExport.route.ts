import {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitJson } from '@conduitplatform/module-tools';
import { ConduitRoute } from '@conduitplatform/hermes';
import { ServiceRegistry } from '../../service-discovery/ServiceRegistry.js';
import AdminModule from '../AdminModule.js';

type ModuleExportClient = {
  getExportableResources: (req: object) => Promise<{ resources: string }>;
  exportResources: (req: { resourceTypes: string[] }) => Promise<{ data: string }>;
};

export function getStateExportRoute(admin: AdminModule) {
  const { grpcSdk } = admin;
  return new ConduitRoute(
    {
      path: '/state/export',
      action: ConduitRouteActions.GET,
      description:
        'Exports full Conduit state: all module configs and exportable resources from each module.',
    },
    new ConduitRouteReturnDefinition('StateExportRoute', {
      configs: ConduitJson.Required,
      modules: ConduitJson.Required,
    }),
    async () => {
      const configs: { modules: Record<string, object> } = { modules: {} };
      const sortedConfigModules = [
        'core',
        'admin',
        ...ServiceRegistry.getInstance().getRegisteredModules(),
      ].sort();
      for (const moduleName of sortedConfigModules) {
        const raw = await grpcSdk.state!.getKey(`moduleConfigs.${moduleName}`);
        if (raw) configs.modules[moduleName] = JSON.parse(raw);
      }

      const modules: Record<string, Record<string, unknown[]>> = {};
      const registered = ServiceRegistry.getInstance().getRegisteredModules();

      for (const moduleName of registered) {
        const client = grpcSdk.getModuleClient(moduleName) as unknown as
          | ModuleExportClient
          | undefined;
        if (!client?.getExportableResources || !client?.exportResources) continue;

        try {
          const res = await client.getExportableResources({});
          const resources = JSON.parse(res.resources || '[]') as {
            type: string;
            priority: number;
          }[];
          if (resources.length === 0) continue;

          const exportRes = await client.exportResources({ resourceTypes: [] });
          const data = JSON.parse(exportRes.data || '{}') as Record<string, unknown[]>;
          if (Object.keys(data).length > 0) modules[moduleName] = data;
        } catch (_) {
          // Module may not support export or be unavailable; skip
        }
      }

      return { configs, modules };
    },
  );
}
