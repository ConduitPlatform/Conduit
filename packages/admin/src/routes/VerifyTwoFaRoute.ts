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

export function verifyTwoFaRoute() {
  return new ConduitRoute(
    {
      path: '/verify-twofa',
      action: ConduitRouteActions.POST,
      bodyParams: {
        email: ConduitString.Required,
        code: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('VerifyTwoFaResponse', {
      message: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const admin = params.context!.admin;
      const { code } = params.params!;
      const context = params.context!;

      if (isNil(context) || isEmpty(context))
        throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');

      if (isNil(admin)) throw new GrpcError(status.UNAUTHENTICATED, 'Admin not found');
      if (admin.twoFaMethod == 'qrcode') {
        return await verify2Fa(admin._id, admin, code);
      } else {
        throw new GrpcError(status.FAILED_PRECONDITION, 'Method not valid');
      }
    },
  );
}
