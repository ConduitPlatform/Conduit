import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { isEmpty, isNil } from 'lodash';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { status } from '@grpc/grpc-js';
import { Admin, AdminTwoFactorSecret } from '../models';
import { verifyTwoFactorToken } from '../utils/auth';

export function verifyQrCodeRoute() {
  return new ConduitRoute(
    {
      path: '/verify-qr-code',
      action: ConduitRouteActions.POST,
      bodyParams: {
        code: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('VerifyQRCodeResponse', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const admin = req.context!.admin;
      const context = req.context!;

      const { code } = req.params!;

      if (isNil(context) || isEmpty(context)) {
        throw new GrpcError(status.UNAUTHENTICATED, 'User unauthenticated');
      }
      if (admin.hasTwoFA) {
        return '2FA already enabled';
      }

      const secret = await AdminTwoFactorSecret.getInstance().findOne({
        adminId: admin._id,
      });
      if (isNil(secret))
        throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');

      const verification = verifyTwoFactorToken(secret.secret, code, 1);
      if (isNil(verification)) {
        throw new GrpcError(status.UNAUTHENTICATED, 'Verification unsuccessful');
      }

      await Admin.getInstance().findByIdAndUpdate(admin._id, {
        hasTwoFA: true,
      });

      return { result: { message: 'OK' } };
    },
  );
}
