import {
  ConduitCommons,
  IConfigManager,
  ConduitError,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitRouteParameters,
  ConduitString,
} from '@quintessential-sft/conduit-commons';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';
import { comparePasswords, signToken } from '../utils/auth';


export function getLoginRoute(conduit: ConduitCommons, grpcSdk: ConduitGrpcSdk) {
  return new ConduitRoute(
    {
      path: '/login',
      action: ConduitRouteActions.POST,
      bodyParams: {
        username: ConduitString.Required,
        password: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('Login', {
      token: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const config: IConfigManager = conduit.getConfigManager();
      const database = grpcSdk.databaseProvider!;

      const { username, password } = params.params!;
      if (isNil(username) || isNil(password)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Both username and password must be provided');
      }

      const admin = await database.findOne('Admin', { username });
      if (isNil(admin)) {
        throw new ConduitError('UNAUTHORIZED', 401, 'Invalid username/password');
      }
      const passwordsMatch = await comparePasswords(password, admin.password);
      if (!passwordsMatch) {
        throw new ConduitError('UNAUTHORIZED', 401, 'Invalid username/password');
      }

      let authConfig = await config.get('admin');
      authConfig = authConfig.auth;
      const { tokenSecret, tokenExpirationTime } = authConfig;

      const token = signToken(
        { id: admin._id.toString() },
        tokenSecret,
        tokenExpirationTime
      );

      return { result: { token } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    }
  );
}
