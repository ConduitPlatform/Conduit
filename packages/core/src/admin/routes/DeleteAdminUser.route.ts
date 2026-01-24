import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitString } from '@conduitplatform/module-tools';

import { isNil } from 'lodash-es';
import { Admin } from '../../models/index.js';
import { ConduitRoute } from '@conduitplatform/hermes';

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
    },
    new ConduitRouteReturnDefinition('DeleteAdminUser', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { id } = req.params!;
      const loggedInAdmin = req.context!.admin;
      if (isNil(id)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Id must be provided');
      }
      const admin = await Admin.getInstance().findOne({ _id: id });
      if (isNil(admin)) {
        throw new ConduitError('NOT_FOUND', 404, 'Admin not found');
      }
      if (admin._id === loggedInAdmin._id) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Admin cannot delete self');
      }
      if (!loggedInAdmin.isSuperAdmin) {
        throw new ConduitError(
          'INVALID_ARGUMENTS',
          400,
          'Only superAdmin can delete admin',
        );
      }
      await Admin.getInstance().deleteOne({ _id: id });
      return { message: 'Admin deleted.' };
    },
  );
}
