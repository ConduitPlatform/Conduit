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
import { generateSecret } from '../utils/auth';

export function enableTwoFaRoute() {
  return new ConduitRoute(
    {
      path: '/enable-twofa',
      action: ConduitRouteActions.UPDATE,
      bodyParams: {
        enableTwoFa: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('EnableTwoFaResponse', {
      message: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const { enableTwoFa } = params.params!;
      const admin = params.context!.admin;
      const context = params.context!;

      if (isNil(context) || isNil(admin)) {
        throw new GrpcError(status.UNAUTHENTICATED, 'Unauthorized');
      }
      if (enableTwoFa === true) {
        if (admin.hasTwoFA) {
          return '2FA already enabled';
        }

        const secret = generateSecret({
          name: 'Conduit',
          account: admin.username,
        });

        await AdminTwoFactorSecret.getInstance().deleteMany({
          adminId: admin._id,
        });

        await AdminTwoFactorSecret.getInstance().create({
          adminId: admin._id,
          secret: secret.secret,
          uri: secret.uri,
          qr: secret.qr,
        });

        return secret.qr.toString();
      } else {
        await Admin.getInstance().findByIdAndUpdate(admin._id, {
          hasTwoFA: false,
        });
        await AdminTwoFactorSecret.getInstance().deleteOne({ adminId: admin._id });

        return { result: { message: 'OK' } };
      }
    },
  );
}
