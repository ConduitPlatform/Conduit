import ConduitGrpcSdk, {
  ConduitError,
  ParsedRouterRequest,
  PlatformTypesEnum,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { Client } from '../models/index.js';
import { isNil } from 'lodash-es';

export class SecurityAdmin {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async createSecurityClient(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { platform, domain, notes } = call.request.params!;
    let { alias } = call.request.params!;
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
    const clientId = randomBytes(15).toString('hex');
    const clientSecret = randomBytes(64).toString('hex');
    const hash = await bcrypt.hash(clientSecret, 10);
    if (!alias) {
      alias = `${platform.toLowerCase()}:${
        platform === 'WEB' ? `${domain}:${clientId}` : clientId
      }`;
    }
    if (platform === PlatformTypesEnum.WEB) {
      this.validateDomain(domain);
    }
    const client = await Client.getInstance().create({
      clientId,
      clientSecret: hash,
      platform,
      domain,
      alias,
      notes,
    });
    ConduitGrpcSdk.Metrics?.increment('security_clients_total', 1, {
      platform: platform.toLowerCase(),
    });
    return { ...client, clientSecret };
  }

  async deleteSecurityClient(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    await Client.getInstance().deleteOne({
      _id: call.request.params!.id,
    });
    ConduitGrpcSdk.Metrics?.decrement('security_clients_total');
    return { message: 'Client deleted' };
  }

  async getSecurityClients(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
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
    if (alias === '') {
      throw new ConduitError(
        'INVALID_ARGUMENTS',
        400,
        'Non-null alias field should not be an empty string',
      );
    }
    if (alias && alias !== client.alias) {
      const existingClient = await Client.getInstance().findOne({ alias });
      if (existingClient) {
        throw new ConduitError(
          'ALREADY_EXISTS',
          409,
          `A security client with an alias of '${alias}' already exists`,
        );
      }
    }
    if (client.platform === PlatformTypesEnum.WEB) {
      this.validateDomain(domain);
    }

    client = await Client.getInstance().findByIdAndUpdate(client._id, {
      domain: client.platform === PlatformTypesEnum.WEB ? domain : undefined,
      alias,
      notes,
    });
    return { ...client };
  }

  validateDomain(domain: string) {
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
}
