import {
  PlatformTypesEnum,
  ConduitRoute,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/commons';
import { Client } from '../../models';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  ConduitError,
} from '@conduitplatform/grpc-sdk';

export function getCreateSecurityClientRoute() {
  return new ConduitRoute(
    {
      path: '/security/client',
      action: ConduitRouteActions.POST,
      bodyParams: {
        platform: ConduitString.Required,
        domain: ConduitString.Optional,
        alias: ConduitString.Optional,
        notes: ConduitString.Optional,
      },
    },
    new ConduitRouteReturnDefinition('CreateSecurityClient', Client.getInstance().fields),
    async (params: ConduitRouteParameters) => {
      const { platform, domain, notes } = params.params!;
      let { alias } = params.params!;
      if (!Object.values(PlatformTypesEnum).includes(platform)) {
        throw new ConduitError('INVALID_ARGUMENTS', 400, 'Platform not supported');
      }
      if (alias === '') {
        throw new ConduitError(
          'INVALID_ARGUMENTS',
          400,
          'Non-null alias field should not be an empty string',
        );
      }
      if (alias) {
        const existingClient = await Client.getInstance().findOne({ alias });
        if (existingClient) {
          throw new ConduitError(
            'ALREADY_EXISTS',
            409,
            `A security client with an alias of '${alias}' already exists`,
          );
        }
      }
      if (platform === PlatformTypesEnum.WEB) {
        if (!domain || domain === '')
          throw new ConduitError(
            'INVALID_ARGUMENTS',
            400,
            'Platform WEB requires domain name',
          );
        if (domain.replace(/[^*]/g, '').length > 1) {
          throw new ConduitError(
            'INVALID_ARGUMENTS',
            400,
            `Domain must not contain more than one '*' character`,
          );
        }
        const domainPattern = new RegExp(
          '^(?!-)[A-Za-z0-9-]+([\\-\\.]{1}[a-z0-9]+)*\\.[A-Za-z]{2,6}$',
        );
        let comparedDomain = domain;
        if (domain.includes('*')) {
          comparedDomain = comparedDomain.split('*.')[1];
        }
        if (!domainPattern.test(comparedDomain) && domain !== '*')
          throw new ConduitError('INVALID_ARGUMENTS', 400, 'Invalid domain argument');
      }
      const clientId = randomBytes(15).toString('hex');
      const clientSecret = randomBytes(64).toString('hex');
      const hash = await bcrypt.hash(clientSecret, 10);
      if (!alias) {
        alias = `${platform.toLowerCase()}:${
          platform === 'WEB' ? `${domain}:${clientId}` : clientId
        }`;
      }
      const client = await Client.getInstance().create({
        clientId,
        clientSecret: hash,
        platform,
        domain,
        alias,
        notes,
      });
      return {
        result: client,
      }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
