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
      path: '/change-user-password/:id',
      action: ConduitRouteActions.UPDATE,
      description: `Super Admin changes authenticated user's password.`,
      urlParams: {
        id: ConduitString.Required,
      },
      bodyParams: {
        newPassword: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('ChangePassword', {
      message: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const { id, newPassword } = params.params!;
      const loggedInAdmin = params.context!.admin;

      if (!loggedInAdmin.isSuperAdmin) {
        throw new ConduitError(
          'INVALID_ARGUMENTS',
          400,
          'Only superAdmin can change other admins password',
        );
      }
      if (isNil(id)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Id must be provided');
      }
      const admin = await Admin.getInstance().findOne({ _id: id });
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
