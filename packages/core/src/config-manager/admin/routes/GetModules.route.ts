import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '@conduitplatform/hermes';
import { isNil } from 'lodash';
import { ConduitBoolean, ConduitString } from '@conduitplatform/module-tools';
import { ServiceRegistry } from '../../service-discovery/ServiceRegistry';

export function getModulesRoute() {
  return new ConduitRoute(
    {
      path: '/config/modules',
      action: ConduitRouteActions.GET,
      description: `Returns as array of currently available modules, providing information about their service.`,
      queryParams: {
        sortByName: ConduitBoolean.Optional,
      },
    },
    new ConduitRouteReturnDefinition('GetModules', {
      modules: [
        {
          moduleName: ConduitString.Required,
          url: ConduitString.Required,
          serving: ConduitBoolean.Required,
        },
      ],
    }),
    async (call: ConduitRouteParameters) => {
      const sortByName = call.params!.sortByName;
      const modules = ServiceRegistry.getInstance().getModuleDetailsList();
      if (modules.length === 0) {
        throw new ConduitError('INTERNAL', 500, 'Modules not available yet');
      }
      if (!isNil(sortByName)) {
        if (sortByName) modules!.sort((a, b) => a.moduleName.localeCompare(b.moduleName));
        else modules!.sort((a, b) => b.moduleName.localeCompare(a.moduleName));
      }
      return { modules };
    },
  );
}
