import { Admin } from '../models';
import { isNil } from 'lodash';
import { comparePasswords, signToken } from '../utils/auth';
import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  ConfigController,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { TwoFactorSecret } from '@conduitplatform/authentication/dist/models';
import { status } from '@grpc/grpc-js';

export function getLoginRoute() {
  return new ConduitRoute(
    {
      path: '/login',
      action: ConduitRouteActions.POST,
      bodyParams: {
        username: ConduitString.Required,
        password: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('Login', {
      token: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const { username, password } = params.params!;
      if (isNil(username) || isNil(password)) {
        throw new ConduitError(
          'INVALID_ARGUMENTS',
          400,
          'Both username and password must be provided',
        );
      }

      const admin = await Admin.getInstance().findOne({ username });
      if (isNil(admin)) {
        throw new ConduitError('UNAUTHORIZED', 401, 'Invalid username/password');
      }
      const passwordsMatch = await comparePasswords(password, admin.password);
      if (!passwordsMatch) {
        throw new ConduitError('UNAUTHORIZED', 401, 'Invalid username/password');
      }
      if (admin.hasTwoFA) {
        if (admin.twoFaMethod === 'qrcode') {
          const secret = await TwoFactorSecret.getInstance().findOne({
            userId: admin._id,
          });
          if (isNil(secret))
            throw new GrpcError(status.NOT_FOUND, 'Authentication unsuccessful');
          return { message: 'OTP required' };
        } else {
          throw new GrpcError(status.FAILED_PRECONDITION, '2FA method not specified');
        }
      }
      const authConfig = ConfigController.getInstance().config.auth;
      const { tokenSecret, tokenExpirationTime } = authConfig;
      const token = signToken(
        { id: admin._id.toString() },
        tokenSecret,
        tokenExpirationTime,
      );
      return { result: { token } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
