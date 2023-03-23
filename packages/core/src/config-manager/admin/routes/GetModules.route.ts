import { RegisteredModule } from '@conduitplatform/commons';
import {
  ConduitBoolean,
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { isNil } from 'lodash';

export function getModulesRoute(registeredModules: Map<string, RegisteredModule>) {
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
      if (registeredModules.size !== 0) {
        const modules: UntypedArray = [];
        registeredModules.forEach((value: RegisteredModule, key: string) => {
          modules.push({
            moduleName: key,
            url: value.address,
            serving: value.serving,
          });
        });
        if (!isNil(sortByName)) {
          if (sortByName)
            modules!.sort((a, b) => a.moduleName.localeCompare(b.moduleName));
          else modules!.sort((a, b) => b.moduleName.localeCompare(a.moduleName));
        }
        return { modules };
      } else {
        throw new ConduitError('INTERNAL', 500, 'Modules not available yet');
      }
    },
  );
}
