import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitString, ModuleError } from '@conduitplatform/module-tools';

import { isNil } from 'lodash-es';
import { Admin } from '../../models/index.js';
import { ConduitRoute } from '@conduitplatform/hermes';
import { errors } from '../../errors.js';

export function deleteAdminUserRoute() {
  return new ConduitRoute(
    {
      path: '/admins/:id',
      action: ConduitRouteActions.DELETE,
      mcp: false,
      description: `Deletes an admin user.`,
      urlParams: {
        id: ConduitString.Required,
      },
      errors: [
        errors.ADMIN_ID_REQUIRED,
        errors.ADMIN_NOT_FOUND,
        errors.ADMIN_CANNOT_DELETE_SELF,
        errors.SUPER_ADMIN_REQUIRED,
      ],
    },
    new ConduitRouteReturnDefinition('DeleteAdminUser', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { id } = req.params!;
      const loggedInAdmin = req.context!.admin;
      if (isNil(id)) {
        throw new ModuleError(errors.ADMIN_ID_REQUIRED);
      }
      const admin = await Admin.getInstance().findOne({ _id: id });
      if (isNil(admin)) {
        throw new ModuleError(errors.ADMIN_NOT_FOUND);
      }
      if (admin._id === loggedInAdmin._id) {
        throw new ModuleError(errors.ADMIN_CANNOT_DELETE_SELF);
      }
      if (!loggedInAdmin.isSuperAdmin) {
        throw new ModuleError(errors.SUPER_ADMIN_REQUIRED);
      }
      await Admin.getInstance().deleteOne({ _id: id });
      return { message: 'Admin deleted.' };
    },
  );
}
