import { ConduitCommons, IConfigManager } from '@conduitplatform/commons';
import { Admin } from '../models';
import { isNil } from 'lodash';
import { comparePasswords, signToken } from '../utils/auth';
import {
  ConduitError,
  ConduitRouteActions,
  ConfigController,
  ConduitRouteParameters,
  ConduitString,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export function getLoginRoute(conduit: ConduitCommons) {
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
      const config: IConfigManager = conduit.getConfigManager();
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
