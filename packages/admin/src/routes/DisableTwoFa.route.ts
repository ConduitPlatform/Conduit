import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { Admin, AdminTwoFactorSecret } from '../models';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { status } from '@grpc/grpc-js';

export function disableTwoFaRoute() {
  return new ConduitRoute(
    {
      path: '/disable-twofa',
      action: ConduitRouteActions.UPDATE,
    },
    new ConduitRouteReturnDefinition('DisableTwoFaResponse', {
      message: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const admin = params.context!.admin;
      const context = params.context!;

      if (isNil(context) || isNil(admin)) {
        throw new GrpcError(status.UNAUTHENTICATED, 'Unauthorized');
      }

      await Admin.getInstance().findByIdAndUpdate(admin._id, {
        twoFaMethod: null,
        hasTwoFA: false,
      });

      await AdminTwoFactorSecret.getInstance().deleteOne({ adminId: admin._id });

      return { result: { message: 'OK' } };
    },
  );
}
