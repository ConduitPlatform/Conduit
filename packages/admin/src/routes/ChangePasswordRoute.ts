import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  ConfigController,
} from '@conduitplatform/grpc-sdk';
import { compare, hash } from 'bcrypt';
import { isNil } from 'lodash';
import { Admin } from '../models';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export function changePasswordRoute() {
  return new ConduitRoute(
    {
      path: '/change-password',
      action: ConduitRouteActions.POST,
      description: `Changes admin user's password.`,
      bodyParams: {
        oldPassword: ConduitString.Required,
        newPassword: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('ChangePassword', {
      message: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const { oldPassword, newPassword } = params.params!;
      const admin = params.context!.admin;
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
      return { result: { message: 'OK' } };
    },
  );
}
