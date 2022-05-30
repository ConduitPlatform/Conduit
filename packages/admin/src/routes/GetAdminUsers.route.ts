import { ConduitCommons } from '@conduitplatform/commons';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/commons';
import { ConduitRouteActions } from '@conduitplatform/grpc-sdk';
import { Admin, schema } from '../models';

export function getAdminUsersRoute(conduit: ConduitCommons) {
  return new ConduitRoute(
    {
      path: '/admins',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition('GetAdminUsers', {
      result: [schema],
    }),
    async () => {
      const admins = await Admin.getInstance().findMany({});
      return { result: admins };
    }
  );
}
