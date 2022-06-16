import ConduitGrpcSdk, {
  ConduitError,
  ParsedRouterRequest,
  PlatformTypesEnum,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Client } from '../models';
import { isNil } from 'lodash';

export class SecurityAdmin {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async createSecurityClient(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { platform, domain, alias, notes } = call.request.params!;
    if (!Object.values(PlatformTypesEnum).includes(platform)) {
      throw new ConduitError('INVALID_ARGUMENTS', 400, 'Platform not supported');
    }
    const clientId = randomBytes(15).toString('hex');
    const clientSecret = randomBytes(64).toString('hex');
    const hash = await bcrypt.hash(clientSecret, 10);
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
    const client = await Client.getInstance().create({
      clientId,
      clientSecret: hash,
      platform,
      domain,
      alias,
      notes,
    });
    return {
      id: client._id,
      clientId,
      clientSecret,
      platform,
      domain,
      alias,
      notes,
    };
  }

  async deleteSecurityClient(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    await Client.getInstance().deleteOne({
      _id: call.request.params!.id,
    });
    return { message: 'Client deleted' };
  }

  async getSecurityClient(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const clients = await Client.getInstance().findMany({});
    return { clients };
  }

  async updateSecurityClient(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { domain, alias, notes } = call.request.params!;
    let client = await Client.getInstance().findOne({
      _id: call.request.params!.id,
    });
    if (isNil(client)) {
      throw new ConduitError('INVALID_PARAMS', 400, 'Security client not found');
    }
    if (client.platform === PlatformTypesEnum.WEB) {
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
      domain: client.platform === PlatformTypesEnum.WEB ? domain : undefined,
      alias,
      notes,
    });
    return {
      id: client!._id,
      clientId: client!.clientId,
      domain: client!.platform === PlatformTypesEnum.WEB ? domain : undefined,
      alias,
      notes,
    };
  }
}
