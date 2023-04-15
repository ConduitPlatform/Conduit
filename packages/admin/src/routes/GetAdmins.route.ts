import { ConduitRouteActions, ConduitRouteParameters } from '@conduitplatform/grpc-sdk';
import { Admin } from '../models';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { ConduitNumber, ConduitString } from '@conduitplatform/module-tools';

export function getAdminsRoute() {
  return new ConduitRoute(
    {
      path: '/admins',
      action: ConduitRouteActions.GET,
      description: `Returns queried admin users and their total count.`,
      queryParams: {
        skip: ConduitNumber.Optional,
        limit: ConduitNumber.Optional,
        sort: ConduitString.Optional,
      },
    },
    new ConduitRouteReturnDefinition('GetAdminUsers', {
      admins: [Admin.name],
      count: ConduitNumber.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const skip = req.params!.skip ?? 0;
      const limit = req.params!.limit ?? 25;
      const sort = req.params!.sort;
      const adminsPromise = Admin.getInstance().findMany(
        {},
        '-password',
        skip,
        limit,
        sort,
      );
      const adminsCountPromise = Admin.getInstance().countDocuments({});
      const [admins, count] = await Promise.all([adminsPromise, adminsCountPromise]);
      return { admins, count };
    },
  );
}
