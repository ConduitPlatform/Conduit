import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { isEmpty, isNil } from 'lodash';
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
      if (admin.twoFaMethod == 'qrcode') {
        return await verify2Fa(admin._id, admin, code);
      } else {
        throw new GrpcError(status.FAILED_PRECONDITION, 'Method not valid');
      }
    },
  );
}
