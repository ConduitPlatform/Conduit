import { NextFunction, Response } from 'express';
import { isNil } from 'lodash-es';
import {
  ConduitGrpcSdk,
  ConduitError,
  DatabaseProvider,
  type FindOneOptions,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { Client } from '../../../models/index.js';
import { validateClient } from '../../utils/index.js';
import { ConduitRequest } from '@conduitplatform/hermes';

const CLIENT_CACHE_TTL_MS = 100000;

export class ClientValidator {
  database: DatabaseProvider;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.database = this.grpcSdk.database!;
  }

  async isProd() {
    const isProd = await this.grpcSdk.state?.getKey('isProd');
    if (isNil(isProd)) {
      const config = await ConfigController.getInstance().config;
      const isProd = config.env === 'production';
      await this.grpcSdk.state?.setKey('isProd', isProd ? 'true' : 'false', 5000);
      return isProd;
    }
    return isProd === 'true';
  }

  async middleware(req: ConduitRequest, res: Response, next: NextFunction) {
    if (isNil(req.conduit)) req.conduit = {};

    const finish = (error?: unknown) => {
      delete req.headers.clientsecret;
      delete req.headers['x-conduit-signature'];
      if (error) {
        next(error);
        return;
      }
      next();
    };

    if (req.path.indexOf('/hook') === 0 || ['/', '/ready'].includes(req.path)) {
      return finish();
    }

    if (
      (req.url === '/graphql' ||
        req.url.startsWith('/swagger') ||
        req.url.startsWith('/reference')) &&
      req.method === 'GET'
    ) {
      const isProd = await this.isProd();
      if (isProd) return finish(ConduitError.unauthorized());
      return finish();
    }

    const securityConfig = ConfigController.getInstance().config.security;
    if (!securityConfig.clientValidation) {
      req.conduit!.clientId = 'anonymous-client';
      delete req.headers.clientid;
      return finish();
    }

    const clientid = req.headers.clientid;
    if (isNil(clientid) || Array.isArray(clientid)) {
      return finish(ConduitError.unauthorized());
    }

    if (!isNil(req.headers.clientsecret)) {
      return finish(ConduitError.unauthorized());
    }

    const key = await this.grpcSdk.state!.getKey(clientid);
    const cached = key ? cachedClient(key) : null;
    if (cached) {
      const validPlatform = await validateClient(req, cached);
      if (validPlatform) {
        req.conduit!.clientId = clientid;
        return finish();
      }
    }

    try {
      const client = await Client.getInstance().findOne({ clientId: clientid }, {
        select: '+clientSecret platform domain',
        readPreference: 'primary',
      } satisfies FindOneOptions);
      if (isNil(client) || !(await validateClient(req, client))) {
        return finish(ConduitError.unauthorized());
      }
      req.conduit!.clientId = clientid;
      void this.grpcSdk
        .state!.setKey(
          clientid,
          JSON.stringify({
            c: client.clientSecret,
            p: client.platform,
            d: client.domain ?? '',
          }),
          CLIENT_CACHE_TTL_MS,
        )
        ?.catch(() => undefined);
      return finish();
    } catch {
      return finish(ConduitError.unauthorized());
    }
  }
}

function cachedClient(raw: string): {
  clientSecret: string;
  platform: string;
  domain?: string;
} | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.c !== 'string' || typeof record.p !== 'string') return null;
    if (record.d !== undefined && typeof record.d !== 'string') return null;
    return {
      clientSecret: record.c,
      platform: record.p,
      domain: typeof record.d === 'string' ? record.d : '',
    };
  } catch {
    return null;
  }
}
