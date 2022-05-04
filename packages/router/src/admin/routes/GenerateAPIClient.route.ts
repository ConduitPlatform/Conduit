import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  ConduitString,
  TYPE,
} from '@conduitplatform/commons';
import { ParsedRouterRequest, UnparsedRouterResponse } from '@conduitplatform/grpc-sdk';
import { ConduitDefaultRouter } from '../..';

export function generateAPIClient(router: ConduitDefaultRouter) {
  return new ConduitRoute(
    {
      path: '/router/generate-client',
      action: ConduitRouteActions.POST,
      bodyParams: {
        outputLanguage: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('GenerateAPIClient', {
      response: TYPE.JSON,
    }),
    async (request: ConduitRouteParameters) => {
      let response: any[] = [];
      console.log(request);
      return { result: response };
    }
  );
}
