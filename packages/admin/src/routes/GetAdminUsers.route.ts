import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/commons';
import {
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
} from '@conduitplatform/grpc-sdk';
import { Admin } from '../models';

export function getAdminUsersRoute() {
  return new ConduitRoute(
    {
      path: '/admins',
      action: ConduitRouteActions.GET,
      queryParams: {
        skip: ConduitNumber.Optional,
        limit: ConduitNumber.Optional,
        sort: ConduitString.Optional,
      },
    },
    new ConduitRouteReturnDefinition('GetAdminUsers', {
      result: [Admin.getInstance().fields],
    }),
    async (params: ConduitRouteParameters) => {
      const skip = params.params!.skip ?? 0;
      const limit = params.params!.limit ?? 25;
      const sort = params.params!.sort;
      const admins = await Admin.getInstance().findMany(
        {},
        '-password',
        skip,
        limit,
        sort
      );
      return { result: admins };
    }
  );
}
