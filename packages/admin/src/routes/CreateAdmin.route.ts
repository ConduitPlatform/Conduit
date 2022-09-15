import { Admin } from '../models';
import { isNil } from 'lodash';
import { hashPassword } from '../utils/auth';
import {
  ConduitError,
  ConduitRouteActions,
  ConfigController,
  ConduitRouteParameters,
  ConduitString,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export function getCreateAdminRoute() {
  return new ConduitRoute(
    {
      path: '/admins',
      action: ConduitRouteActions.POST,
      description: `Creates a new admin using username/password.`,
      bodyParams: {
        username: ConduitString.Required,
        password: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('Create', {
      message: ConduitString.Required,
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
      if (!isNil(admin)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Already exists');
      }
      const adminConfig = ConfigController.getInstance().config;
      const hashRounds = adminConfig.auth.hashRounds;
      const pass = await hashPassword(password, hashRounds);
      await Admin.getInstance().create({ username: username, password: pass });

      return { result: { message: 'OK' } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
