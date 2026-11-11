import { errors } from '../../errors.js';
import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitString } from '@conduitplatform/module-tools';
import { ConduitRoute } from '@conduitplatform/hermes';
import { verify2Fa } from '../utils/auth.js';

export function verifyTwoFaRoute() {
  return new ConduitRoute(
    {
      path: '/verify-twofa',
      action: ConduitRouteActions.POST,
      mcp: false,
      bodyParams: {
        code: ConduitString.Required,
      },
      errors: [errors.ADMIN_TWO_FA_NOT_CONFIGURED, errors.ADMIN_TWO_FA_CODE_INVALID],
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
