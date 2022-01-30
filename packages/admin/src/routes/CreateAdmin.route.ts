import {
  ConduitCommons,
  ConduitError,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitRouteParameters,
  ConduitString,
} from '@conduitplatform/conduit-commons';
import { Admin } from '../models';
import { isNil } from 'lodash';
import { hashPassword } from '../utils/auth';


export function getCreateAdminRoute(conduit: ConduitCommons) {
  return new ConduitRoute(
    {
      path: '/create',
      action: ConduitRouteActions.POST,
      bodyParams: {
        username: ConduitString.Required,
        password: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('Create', {
      message: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const { username, password } = params.params!;
      if (isNil(username) || isNil(password)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Both username and password must be provided');
      }

      const admin = await Admin.getInstance().findOne({ username });
      if (!isNil(admin)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Already exists');
      }
      const adminConfig = await conduit.getConfigManager().get('admin');
      const hashRounds = adminConfig.auth.hashRounds;
      let pass = await hashPassword(password, hashRounds);
      await Admin.getInstance().create({ username: username, password: pass });

      return { result: { message: 'OK' } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    }
  );
}
