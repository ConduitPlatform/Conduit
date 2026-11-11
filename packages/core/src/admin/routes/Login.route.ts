import { Admin, AdminTwoFactorSecret } from '../../models/index.js';
import { isNil } from 'lodash-es';
import { comparePasswords, signToken } from '../utils/auth.js';
import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  type FindOneOptions,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitString,
  ConfigController,
  ModuleError,
} from '@conduitplatform/module-tools';
import { ConduitRoute } from '@conduitplatform/hermes';
import { errors } from '../../errors.js';

export function getLoginRoute() {
  return new ConduitRoute(
    {
      path: '/login',
      action: ConduitRouteActions.POST,
      mcp: false,
      description: `Login endpoint for admin users.`,
      bodyParams: {
        username: ConduitString.Required,
        password: ConduitString.Required,
      },
      errors: [
        errors.USERNAME_AND_PASSWORD_REQUIRED,
        errors.INVALID_ADMIN_CREDENTIALS,
        errors.ADMIN_TWO_FA_NOT_CONFIGURED,
      ],
    },
    new ConduitRouteReturnDefinition('Login', {
      token: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { username, password } = req.params!;
      if (isNil(username) || isNil(password)) {
        throw new ModuleError(errors.USERNAME_AND_PASSWORD_REQUIRED);
      }

      const admin = await Admin.getInstance().findOne(
        { username },
        { select: '+password' },
      );
      if (isNil(admin)) {
        throw new ModuleError(errors.INVALID_ADMIN_CREDENTIALS);
      }
      const passwordsMatch = await comparePasswords(password, admin.password);
      if (!passwordsMatch) {
        throw new ModuleError(errors.INVALID_ADMIN_CREDENTIALS);
      }
      if (admin.hasTwoFA) {
        const secret = await AdminTwoFactorSecret.getInstance().findOne(
          { adminId: admin._id },
          { readPreference: 'primary' } satisfies FindOneOptions,
        );
        if (isNil(secret)) throw new ModuleError(errors.ADMIN_TWO_FA_NOT_CONFIGURED);

        const authConfig = ConfigController.getInstance().config.auth;
        const { tokenSecret } = authConfig;
        const token = signToken(
          { id: admin._id.toString(), twoFaRequired: true },
          tokenSecret,
          60,
        );
        return { token };
      }
      const authConfig = ConfigController.getInstance().config.auth;
      const { tokenSecret, tokenExpirationTime } = authConfig;
      const token = signToken(
        { id: admin._id.toString() },
        tokenSecret,
        tokenExpirationTime,
      );
      return { token };
    },
  );
}
