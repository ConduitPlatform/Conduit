import {
  ConduitRoute,
  ConduitRouteReturnDefinition,
  PlatformTypesEnum,
} from '@conduitplatform/commons';
import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  RouteOptionType,
} from '@conduitplatform/grpc-sdk';
import { Client } from '../../models';
import { isNil } from 'lodash';

export function getUpdateSecurityClientRoute() {
  return new ConduitRoute(
    {
      path: '/security/client/:id',
      urlParams: {
        id: ConduitString.Required,
      },
      action: ConduitRouteActions.UPDATE,
      bodyParams: {
        platform: ConduitString.Optional,
        domain: ConduitString.Optional,
        alias: ConduitString.Optional,
        notes: ConduitString.Optional,
      },
    },
    new ConduitRouteReturnDefinition('UpdateSecurityClient', {
      id: ConduitString.Required,
      clientId: ConduitString.Required,
      clientSecret: ConduitString.Required,
      platform: ConduitString.Optional,
      domain: ConduitString.Optional,
      alias: ConduitString.Optional,
      notes: ConduitString.Optional,
    }),
    async (params: ConduitRouteParameters) => {
      const { platform, domain, alias, notes } = params.params!;
      let client = await Client.getInstance().findOne({
        _id: params.params!.id,
      });
      if (isNil(client)) {
        throw new ConduitError('INVALID_PARAMS', 400, 'Security client not found');
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

      client = await Client.getInstance().findByIdAndUpdate(client._id, {
        platform,
        domain: platform === PlatformTypesEnum.WEB ? domain : undefined,
        alias,
        notes,
      });
      return {
        result: {
          id: client!._id,
          clientId: client!.clientId,
          clientSecret: client!.clientSecret,
          platform,
          domain,
          alias,
          notes,
        },
      };
    },
  );
}
