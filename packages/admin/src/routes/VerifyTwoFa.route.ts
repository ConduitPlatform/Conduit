import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { status } from '@grpc/grpc-js';
import { verify2Fa } from '../utils/auth';
import { Admin } from '../models';

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
      const { username, code } = params.params!;
      const admin = await Admin.getInstance().findOne({ name: username });
      if (isNil(admin)) throw new GrpcError(status.UNAUTHENTICATED, 'Admin not found');
      return await verify2Fa(admin._id, admin, code);
    },
  );
}
