import {
  ConduitRouteActions,
  ConduitRouteParameters,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { ConduitBoolean, ConduitString } from '@conduitplatform/module-tools';
import { isNil } from 'lodash';
import { Admin, AdminTwoFactorSecret } from '../models';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { status } from '@grpc/grpc-js';
import { generateSecret } from '../utils/auth';

export function toggleTwoFaRoute() {
  return new ConduitRoute(
    {
      path: '/toggle-twofa',
      action: ConduitRouteActions.UPDATE,
      bodyParams: {
        enableTwoFa: ConduitBoolean.Required,
      },
    },
    new ConduitRouteReturnDefinition('ToggleTwoFaResponse', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { enableTwoFa } = req.params!;
      const admin = req.context!.admin;
      const context = req.context!;

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

        return { message: 'OK' };
      }
    },
  );
}
