import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  ConfigController,
} from '@conduitplatform/grpc-sdk';
import { compare, hash } from 'bcrypt';
import { Admin } from '../models';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { isNil } from 'lodash';

export function changePasswordRoute() {
  return new ConduitRoute(
    {
      path: '/change-password',
      action: ConduitRouteActions.UPDATE,
      description: `Changes authenticated admin user's password.`,
      bodyParams: {
        oldPassword: ConduitString.Required,
        newPassword: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('ChangePassword', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { oldPassword, newPassword } = req.params!;
      const admin = await Admin.getInstance().findOne(
        { _id: req.context!.admin },
        '+password',
      );
      if (!admin) {
        throw ConduitError.notFound('Authenticated admin no longer exists');
      }

      if (isNil(oldPassword) || isNil(newPassword)) {
        throw new ConduitError(
          'INVALID_ARGUMENTS',
          400,
          'Both old and new password must be provided',
        );
      }

      const hashRounds = ConfigController.getInstance().config.auth.hashRounds;
      const passwordsMatch = await compare(oldPassword, admin.password);

      if (!passwordsMatch) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Incorrect Password');
      }
      await Admin.getInstance().findByIdAndUpdate(admin._id, {
        password: await hash(newPassword, hashRounds ?? 11),
      });
      return { message: 'OK' };
    },
  );
}
