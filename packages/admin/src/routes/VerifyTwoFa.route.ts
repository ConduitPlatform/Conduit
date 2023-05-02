import { ConduitRouteActions, ConduitRouteParameters } from '@conduitplatform/grpc-sdk';
import { ConduitString } from '@conduitplatform/module-tools';
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
    async (req: ConduitRouteParameters) => {
      const { code } = req.params!;
      const admin = req.context!.admin;
      return await verify2Fa(admin, code);
    },
  );
}
