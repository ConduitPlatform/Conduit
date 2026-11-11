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
import { hash } from 'bcrypt';
import { isNil } from 'lodash-es';
import { Admin } from '../../models/index.js';
import { ConduitRoute } from '@conduitplatform/hermes';
import { errors } from '../../errors.js';

export function changeUsersPasswordRoute() {
  return new ConduitRoute(
    {
      path: '/admins/:adminId/change-password',
      action: ConduitRouteActions.UPDATE,
      mcp: false,
      description: `Changes target admin user's password as a super admin.`,
      urlParams: {
        adminId: ConduitString.Required,
      },
      bodyParams: {
        newPassword: ConduitString.Required,
      },
      errors: [
        errors.SUPER_ADMIN_REQUIRED,
        errors.ADMIN_ID_REQUIRED,
        errors.ADMIN_NOT_FOUND,
      ],
    },
    new ConduitRouteReturnDefinition('ChangePassword', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { adminId, newPassword } = req.params!;
      const loggedInAdmin = req.context!.admin;

      if (!loggedInAdmin.isSuperAdmin) {
        throw new ModuleError(errors.SUPER_ADMIN_REQUIRED);
      }
      if (isNil(adminId)) {
        throw new ModuleError(errors.ADMIN_ID_REQUIRED);
      }
      const admin = await Admin.getInstance().findOne({ _id: adminId });
      if (isNil(admin)) {
        throw new ModuleError(errors.ADMIN_NOT_FOUND);
      }

      const hashRounds = ConfigController.getInstance().config.auth.hashRounds;

      await Admin.getInstance().findByIdAndUpdate(admin._id, {
        password: await hash(newPassword, hashRounds ?? 11),
      });

      return { message: 'OK' };
    },
  );
}
