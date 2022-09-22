import { Admin, AdminTwoFactorSecret } from '../models';
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
import { status } from '@grpc/grpc-js';

export function getLoginRoute() {
  return new ConduitRoute(
    {
      path: '/login',
      action: ConduitRouteActions.POST,
      description: `Login endpoint for admin users.`,
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
        const secret = await AdminTwoFactorSecret.getInstance().findOne({
          adminId: admin._id,
        });
        if (isNil(secret))
          throw new GrpcError(status.NOT_FOUND, 'Authentication unsuccessful');

        const authConfig = ConfigController.getInstance().config.auth;
        const { tokenSecret, tokenExpirationTime } = authConfig;
        const token = signToken(
          { id: admin._id.toString(), twoFaRequired: true },
          tokenSecret,
          tokenExpirationTime,
        );
        return { result: { token } };
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
