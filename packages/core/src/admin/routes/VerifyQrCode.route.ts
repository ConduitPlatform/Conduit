import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  type FindOneOptions,
} from '@conduitplatform/grpc-sdk';
import { isEmpty, isNil } from 'lodash-es';
import { ConduitRoute } from '@conduitplatform/hermes';
import { Admin, AdminTwoFactorSecret } from '../../models/index.js';
import { verifyTwoFactorToken } from '../utils/auth.js';
import { ConduitString, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';

export function verifyQrCodeRoute() {
  return new ConduitRoute(
    {
      path: '/verify-qr-code',
      action: ConduitRouteActions.POST,
      mcp: false,
      bodyParams: {
        code: ConduitString.Required,
      },
      errors: [
        errors.ADMIN_AUTHENTICATION_REQUIRED,
        errors.ADMIN_TWO_FA_NOT_CONFIGURED,
        errors.ADMIN_TWO_FA_CODE_INVALID,
      ],
    },
    new ConduitRouteReturnDefinition('VerifyQRCodeResponse', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const admin = req.context!.admin;
      const context = req.context!;

      const { code } = req.params!;

      if (isNil(context) || isEmpty(context)) {
        throw new ModuleError(errors.ADMIN_AUTHENTICATION_REQUIRED);
      }
      if (admin.hasTwoFA) {
        return '2FA already enabled';
      }

      const secret = await AdminTwoFactorSecret.getInstance().findOne(
        { adminId: admin._id },
        { readPreference: 'primary' } satisfies FindOneOptions,
      );
      if (isNil(secret)) throw new ModuleError(errors.ADMIN_TWO_FA_NOT_CONFIGURED);

      const verification = verifyTwoFactorToken(secret.secret, code, 1);
      if (isNil(verification)) {
        throw new ModuleError(errors.ADMIN_TWO_FA_CODE_INVALID);
      }

      await Admin.getInstance().findByIdAndUpdate(admin._id, {
        hasTwoFA: true,
      });

      return { message: 'OK' };
    },
  );
}
