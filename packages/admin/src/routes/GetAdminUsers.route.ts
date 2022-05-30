import { ConduitCommons } from "@conduitplatform/commons";
import { ConduitRoute, ConduitRouteReturnDefinition } from "@conduitplatform/commons";
import { ConduitRouteActions } from "@conduitplatform/grpc-sdk";
import { Admin, schema as AdminSchema } from "../models";

export function GetAdminUsersRoute(conduit: ConduitCommons) {
  return new ConduitRoute({
    path: '/',
    action: ConduitRouteActions.GET,
  },
  new ConduitRouteReturnDefinition('GetAdminUsers', {
    result: [AdminSchema],
  }),
  async () => {
    const admins = await Admin.getInstance().findMany({});
    return { result: admins };
  });
}