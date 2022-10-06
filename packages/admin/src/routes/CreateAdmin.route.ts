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
    async (req: ConduitRouteParameters) => {
      const { username, password } = req.params!;
      const loggedInAdmin = req.context!.admin;

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

      if (!loggedInAdmin.isSuperAdmin) {
        throw new ConduitError(
          'INVALID_ARGUMENTS',
          400,
          'Only superAdmin can create admin',
        );
      }
      const adminConfig = ConfigController.getInstance().config;
      const hashRounds = adminConfig.auth.hashRounds;
      const pass = await hashPassword(password, hashRounds);
      await Admin.getInstance().create({ username: username, password: pass });

      return { message: 'OK' };
    },
  );
}
