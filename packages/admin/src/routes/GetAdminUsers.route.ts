import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/commons';
import { ConduitRouteActions } from '@conduitplatform/grpc-sdk';
import { Admin } from '../models';

export function getAdminUsersRoute() {
  return new ConduitRoute(
    {
      path: '/admins',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition('GetAdminUsers', {
      result: [Admin.getInstance().fields],
    }),
    async () => {
      const admins = await Admin.getInstance().findMany({}, '-password');
      return { result: admins };
    }
  );
}
