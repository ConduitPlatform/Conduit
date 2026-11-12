import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitString,
  ModuleError,
} from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';
import { isNil } from 'lodash-es';
import { Admin, AdminTwoFactorSecret } from '../../models/index.js';
import { ConduitRoute } from '@conduitplatform/hermes';
import { generateSecret } from '../utils/auth.js';

export function toggleTwoFaRoute(grpcSdk: ConduitGrpcSdk) {
  return new ConduitRoute(
    {
      path: '/toggle-twofa',
      action: ConduitRouteActions.UPDATE,
      mcp: false,
      bodyParams: {
        enableTwoFa: ConduitBoolean.Required,
      },
      errors: [errors.ADMIN_AUTHENTICATION_REQUIRED],
    },
    new ConduitRouteReturnDefinition('ToggleTwoFaResponse', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { enableTwoFa } = req.params!;
      const admin = req.context!.admin;
      const context = req.context!;

      if (isNil(context) || isNil(admin)) {
        throw new ModuleError(errors.ADMIN_AUTHENTICATION_REQUIRED);
      }
      if (enableTwoFa === true) {
        if (admin.hasTwoFA) {
          return '2FA already enabled';
        }

        const secret = await generateSecret({
          name: 'Conduit',
          account: admin.username,
        });

        await grpcSdk.database!.withOptionalTransaction(async db => {
          await AdminTwoFactorSecret.getInstance().deleteMany(
            {
              adminId: admin._id,
            },
            { transaction: db },
          );

          await AdminTwoFactorSecret.getInstance().create(
            {
              adminId: admin._id,
              secret: secret.secret,
              uri: secret.uri,
              qr: secret.qr,
            },
            { transaction: db },
          );
        });

        return secret.qr.toString();
      } else {
        await grpcSdk.database!.withOptionalTransaction(async db => {
          await Admin.getInstance().findByIdAndUpdate(
            admin._id,
            {
              hasTwoFA: false,
            },
            { transaction: db },
          );
          await AdminTwoFactorSecret.getInstance().deleteOne(
            { adminId: admin._id },
            { transaction: db },
          );
        });

        return { message: 'OK' };
      }
    },
  );
}
