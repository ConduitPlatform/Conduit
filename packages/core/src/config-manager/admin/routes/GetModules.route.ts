import { RegisteredModule } from '@conduitplatform/commons';
import {
  ConduitRouteActions,
  ConduitError,
  ConduitString,
  ConduitBoolean,
  GrpcError,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';

export function getModulesRoute(registeredModules: Map<string, RegisteredModule>) {
  return new ConduitRoute(
    {
      path: '/config/modules',
      action: ConduitRouteActions.GET,
      description: `Returns as array of currently available modules, providing information about their service.`,
      queryParams: {
        sort: ConduitString.Optional,
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
      const sort = call.params!.sort;
      if (!isNil(sort) && sort !== 'name' && sort !== '-name')
        throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid value for sort parameter.');
      if (registeredModules.size !== 0) {
        const modules: any[] = [];
        registeredModules.forEach((value: RegisteredModule, key: string) => {
          modules.push({
            moduleName: key,
            url: value.address,
            serving: value.serving,
          });
        });
        if (sort === 'name')
          modules.sort((a, b) => a.moduleName.localeCompare(b.moduleName));
        else if (sort === '-name')
          modules.sort((a, b) => b.moduleName.localeCompare(a.moduleName));
        return { modules };
      } else {
        throw new ConduitError('INTERNAL', 500, 'Modules not available yet');
      }
    },
  );
}
