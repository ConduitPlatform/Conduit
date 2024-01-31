import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitString } from '@conduitplatform/module-tools';
import { Admin } from '../models/index.js';
import { ConduitRoute } from '@conduitplatform/hermes';

export function getAdminRoute() {
  return new ConduitRoute(
    {
      path: '/admins/:id',
      action: ConduitRouteActions.GET,
      description: `Returns an admin user. Passing 'me' as 'id' returns the authenticated admin performing the request`,
      urlParams: {
        id: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('GetAdmin', Admin.name),
    async (req: ConduitRouteParameters) => {
      const adminId = req.params!.id;
      const admin: Admin =
        adminId === 'me'
          ? req.context!.admin
          : await Admin.getInstance().findOne({ _id: adminId });
      if (!admin) {
        throw ConduitError.notFound('Admin does not exist');
      }
      return admin;
    },
  );
}
