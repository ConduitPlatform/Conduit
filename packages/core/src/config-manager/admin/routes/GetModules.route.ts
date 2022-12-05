import { DeploymentState_ModuleStateInfo as ModuleStateInfo } from '@conduitplatform/commons';
import {
  ConduitRouteActions,
  ConduitString,
  ConduitBoolean,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export function getModulesRoute(registeredModules: Map<string, ModuleStateInfo>) {
  return new ConduitRoute(
    {
      path: '/config/modules',
      action: ConduitRouteActions.GET,
      description: `Returns as array of online modules, providing information about their service.`,
      queryParams: {
        sortByName: ConduitBoolean.Optional,
        available: ConduitBoolean.Optional,
      },
    },
    new ConduitRouteReturnDefinition('GetModules', {
      modules: [
        {
          moduleName: ConduitString.Required,
          moduleVersion: ConduitString.Required,
          moduleUrl: ConduitString.Required,
          pending: ConduitBoolean.Required,
          serving: ConduitBoolean.Required,
        },
      ],
    }),
    async (call: ConduitRouteParameters) => {
      const availableFilter = call.params!.pending;
      const sortByName = call.params!.sortByName === true;
      const modules = [...registeredModules.values()].filter(m =>
        availableFilter === undefined ? true : m.pending !== availableFilter,
      );
      return {
        modules: sortByName
          ? modules.sort((a, b) => a.moduleName.localeCompare(b.moduleName))
          : modules,
      };
    },
  );
}
