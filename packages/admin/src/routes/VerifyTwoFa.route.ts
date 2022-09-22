import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { verify2Fa } from '../utils/auth';

export function verifyTwoFaRoute() {
  return new ConduitRoute(
    {
      path: '/verify-twofa',
      action: ConduitRouteActions.POST,
      bodyParams: {
        code: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('VerifyTwoFaResponse', {
      token: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const { code } = params.params!;
      const admin = params.context!.admin;
      return await verify2Fa(admin, code);
    },
  );
}
