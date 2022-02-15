import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitRouteParameters,
  ConduitError,
  PlatformTypesEnum,
  ConduitString,
} from '@conduitplatform/commons';
import { Client } from '../../models';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

export function getCreateSecurityClientRoute() {
  return new ConduitRoute(
    {
      path: '/security/client',
      action: ConduitRouteActions.POST,
      bodyParams: {
        platform: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('CreateSecurityClient', {
      id: ConduitString.Required,
      clientId: ConduitString.Required,
      clientSecret: ConduitString.Required,
      platform: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      const { platform } = params.params!;
      if (!Object.values(PlatformTypesEnum).includes(platform)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Platform not supported');
      }
      let clientId = randomBytes(15).toString('hex');
      let clientSecret = randomBytes(64).toString('hex');
      let hash = await bcrypt.hash(clientSecret, 10);
      let client = await Client.getInstance().create({
        clientId,
        clientSecret: hash,
        platform,
      });
      return { result: { id: client._id, clientId, clientSecret, platform } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    }
  );
}
