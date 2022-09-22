import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  ConfigController,
} from '@conduitplatform/grpc-sdk';
import { hash } from 'bcrypt';
import { isNil } from 'lodash';
import { Admin } from '../models';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export function changeUsersPasswordRoute() {
  return new ConduitRoute(
    {
      path: '/change-password/:adminId',
      action: ConduitRouteActions.UPDATE,
      description: `Changes target admin user's password as a super admin.`,
      urlParams: {
        adminId: ConduitString.Required,
      },
      bodyParams: {
        newPassword: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('ChangePassword', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { adminId, newPassword } = req.params!;
      const loggedInAdmin = req.context!.admin;

      if (!loggedInAdmin.isSuperAdmin) {
        throw new ConduitError(
          'INVALID_ARGUMENTS',
          400,
          'Only superAdmin can change other admins password',
        );
      }
      if (isNil(adminId)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Id must be provided');
      }
      const admin = await Admin.getInstance().findOne({ _id: adminId });
      if (isNil(admin)) {
        throw new ConduitError('NOT_FOUND', 404, 'Admin not found');
      }

      const hashRounds = ConfigController.getInstance().config.auth.hashRounds;

      await Admin.getInstance().findByIdAndUpdate(admin._id, {
        password: await hash(newPassword, hashRounds ?? 11),
      });

      return { result: { message: 'OK' } };
    },
  );
}
