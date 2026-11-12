import { Admin } from '../../models/index.js';
import { isNil } from 'lodash-es';
import { hashPassword } from '../utils/auth.js';
import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitString,
  ConfigController,
  ModuleError,
} from '@conduitplatform/module-tools';

import { ConduitRoute } from '@conduitplatform/hermes';
import { errors } from '../../errors.js';

export function getCreateAdminRoute() {
  return new ConduitRoute(
    {
      path: '/admins',
      action: ConduitRouteActions.POST,
      mcp: false,
      description: `Creates a new admin using username/password.`,
      bodyParams: {
        username: ConduitString.Required,
        password: ConduitString.Required,
      },
      errors: [
        errors.USERNAME_AND_PASSWORD_REQUIRED,
        errors.ADMIN_USERNAME_TAKEN,
        errors.SUPER_ADMIN_REQUIRED,
      ],
    },
    new ConduitRouteReturnDefinition('Create', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { username, password } = req.params!;
      const loggedInAdmin = req.context!.admin;

      if (isNil(username) || isNil(password)) {
        throw new ModuleError(errors.USERNAME_AND_PASSWORD_REQUIRED);
      }

      const admin = await Admin.getInstance().findOne({ username });
      if (!isNil(admin)) {
        throw new ModuleError(errors.ADMIN_USERNAME_TAKEN);
      }

      if (!loggedInAdmin.isSuperAdmin) {
        throw new ModuleError(errors.SUPER_ADMIN_REQUIRED);
      }
      const adminConfig = ConfigController.getInstance().config;
      const hashRounds = adminConfig.auth.hashRounds;
      const pass = await hashPassword(password, hashRounds);
      await Admin.getInstance().create({ username: username, password: pass });

      return { message: 'OK' };
    },
  );
}
