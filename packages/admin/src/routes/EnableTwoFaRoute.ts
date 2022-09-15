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
import { generateSecret, generateToken } from '../utils/auth';

export function enableTwoFaRoute() {
  return new ConduitRoute(
    {
      path: '/enable-twofa',
      action: ConduitRouteActions.UPDATE,
      bodyParams: {
        method: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('EnableTwoFaResponse', {
      message: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const admin = params.context!.admin;
      const { method } = params.params!;
      const context = params.context!;

      if (isNil(context) || isNil(admin)) {
        throw new GrpcError(status.UNAUTHENTICATED, 'Unauthorized');
      }
      if (admin.hasTwoFA) {
        return '2FA already enabled';
      }

      if (method === 'qrcode') {
        const secret = generateSecret({
          name: 'Conduit',
          account: admin.email,
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

        await Admin.getInstance().findByIdAndUpdate(admin._id, {
          twoFaMethod: 'qrcode',
        });

        const code = generateToken(secret.secret);

        return { secret: secret.qr.toString(), code: code?.token.toString() };
      }
      throw new GrpcError(status.INVALID_ARGUMENT, 'Method not valid');
    },
  );
}
