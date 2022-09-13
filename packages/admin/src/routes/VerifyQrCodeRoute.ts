import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { isEmpty, isNil } from 'lodash';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { status } from '@grpc/grpc-js';
import { TwoFactorSecret, User } from '@conduitplatform/authentication/dist/models';
import { TwoFactorAuth } from '@conduitplatform/authentication/dist/TwoFactorAuth';

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
    async (params: ConduitRouteParameters) => {
      const admin = params.context!.admin;
      const context = params.context!;

      const { code } = params.params!;

      if (isNil(context) || isEmpty(context)) {
        throw new GrpcError(status.UNAUTHENTICATED, 'User unauthenticated');
      }
      if (admin) {
        return '2FA already enabled';
      }

      const secret = await TwoFactorSecret.getInstance().findOne({
        userId: admin._id,
      });
      if (isNil(secret))
        throw new GrpcError(status.NOT_FOUND, 'Verification unsuccessful');

      const verification = TwoFactorAuth.verifyToken(secret.secret, code);
      if (isNil(verification)) {
        throw new GrpcError(status.UNAUTHENTICATED, 'Verification unsuccessful');
      }

      await User.getInstance().findByIdAndUpdate(context.user._id, {
        hasTwoFA: true,
      });

      return { result: { message: 'OK' } };
    },
  );
}
