import {
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { Admin } from '../models';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export function getAdminUsersRoute() {
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
      // DO NOT REMOVE THIS.
      // The database instance is not initialized when this route is registered
      admins: [
        {
          _id: TYPE.ObjectId,
          username: {
            type: TYPE.String,
            required: true,
          },
          password: {
            type: TYPE.String,
            required: true,
          },
          hasTwoFA: {
            type: TYPE.Boolean,
            required: false,
          },
          twoFaMethod: {
            type: TYPE.String,
            required: false,
          },
          isSuperAdmi: {
            type: TYPE.Boolean,
            required: true,
          },
          createdAt: TYPE.Date,
          updatedAt: TYPE.Date,
        },
      ],
      count: ConduitNumber.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const skip = params.params!.skip ?? 0;
      const limit = params.params!.limit ?? 25;
      const sort = params.params!.sort;
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
