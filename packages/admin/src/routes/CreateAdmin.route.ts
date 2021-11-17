import {
  ConduitCommons,
  ConduitError,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitRouteParameters,
  ConduitString,
} from '@quintessential-sft/conduit-commons';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';
import { hashPassword } from '../utils/auth';


export function getCreateAdminRoute(conduit: ConduitCommons, grpcSdk: ConduitGrpcSdk) {
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
      result: { // unnested in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
        message: ConduitString.Required,
      },
    }),
    async (params: ConduitRouteParameters) => {
      const database = grpcSdk.databaseProvider!;

      const { username, password } = params.params!;
      if (isNil(username) || isNil(password)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Both username and password must be provided');
      }

      const admin = await database.findOne('Admin', { username });
      if (!isNil(admin)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Already exists');
      }
      const adminConfig = await conduit.getConfigManager().get('admin');
      const hashRounds = adminConfig.auth.hashRounds;
      let pass = await hashPassword(password, hashRounds);
      await database.create('Admin', { username: username, password: pass });

      return { result: { message: 'OK' } };
    }
  );
}
