import { NextFunction, Response } from 'express';
import { isNil } from 'lodash-es';
import {
  ConduitGrpcSdk,
  ConduitError,
  DatabaseProvider,
  PlatformTypesEnum,
  type FindOneOptions,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { ConduitRequest, isSocketHandshake } from '@conduitplatform/hermes';
import { Client } from '../../../models/index.js';
import { validateClient } from '../../utils/index.js';
import { parseUnixMillis, signatureReplayTtlMs } from '../../clientValidation.logic.js';

const CLIENT_CACHE_TTL_MS = 100000;
const REJECTION_WARNING_INTERVAL_MS = 60 * 1000;
const lastRejectionWarningAt = new Map<string, number>();

export function resetClientRejectionWarnings(): void {
  lastRejectionWarningAt.clear();
}

function warnClientRejection(clientId: string, message: string): void {
  const now = Date.now();
  const previous = lastRejectionWarningAt.get(clientId);
  if (previous !== undefined && now - previous < REJECTION_WARNING_INTERVAL_MS) {
    return;
  }
  lastRejectionWarningAt.set(clientId, now);
  ConduitGrpcSdk.Logger.warn(message);
}

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

    if (!isSocketHandshake(req) && req.originalUrl == null && requestQueryHasSid(req)) {
      return finish();
    }

    const clientid = req.headers.clientid;
    if (isNil(clientid) || Array.isArray(clientid)) {
      return finish(ConduitError.unauthorized());
    }
    const warn = (message: string) => warnClientRejection(clientid, message);

    let redisUnavailable = false;
    try {
      let cached: ReturnType<typeof cachedClient> = null;
      try {
        const key = await this.grpcSdk.state!.getKey(clientid);
        cached = key ? cachedClient(key) : null;
      } catch (err) {
        redisUnavailable = true;
        throw err;
      }

      if (cached) {
        const cachedResult = await this.acceptKnownClient(
          req,
          cached,
          clientid,
          false,
          warn,
        );
        if (cachedResult === 'ok') return finish();
        return finish(ConduitError.unauthorized());
      }

      const client = await Client.getInstance().findOne({ clientId: clientid }, {
        select: '+clientSecret platform domain',
        readPreference: 'primary',
      } satisfies FindOneOptions);
      if (isNil(client)) {
        warn(`Client signature rejected: unknown client ${clientid}`);
        return finish(ConduitError.unauthorized());
      }
      const loadedResult = await this.acceptKnownClient(
        req,
        client,
        clientid,
        true,
        warn,
      );
      if (loadedResult === 'ok') return finish();
      return finish(ConduitError.unauthorized());
    } catch (err) {
      if (
        redisUnavailable ||
        (err as { redisUnavailable?: boolean } | undefined)?.redisUnavailable
      ) {
        warn('Client signature rejected: Redis is unavailable');
      }
      return finish(ConduitError.unauthorized());
    }
  }

  private async acceptKnownClient(
    req: ConduitRequest,
    client: { platform: string; domain?: string; clientSecret: string },
    clientid: string,
    writeCache: boolean,
    warn: (message: string) => void,
  ): Promise<'ok' | 'reject'> {
    if (client.platform !== PlatformTypesEnum.WEB && !isNil(req.headers.clientsecret)) {
      return 'reject';
    }
    if (!(await validateClient(req, client, clientid, warn))) {
      return 'reject';
    }
    if (client.platform !== PlatformTypesEnum.WEB) {
      const signature = req.headers['x-conduit-signature'];
      if (typeof signature !== 'string') return 'reject';
      const timestampHeader = req.headers['x-conduit-timestamp'];
      const timestampMs =
        typeof timestampHeader === 'string' ? parseUnixMillis(timestampHeader) : null;
      if (timestampMs === null) return 'reject';
      let stored: boolean;
      try {
        stored = await this.grpcSdk.state!.setIfAbsent(
          `client-sig:${clientid}:${signature}`,
          '1',
          signatureReplayTtlMs(timestampMs, Date.now()),
        );
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error('Redis is unavailable');
        (wrapped as Error & { redisUnavailable?: boolean }).redisUnavailable = true;
        throw wrapped;
      }
      if (!stored) return 'reject';
    }
    req.conduit!.clientId = clientid;
    if (writeCache) {
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
    }
    return 'ok';
  }
}

function requestQueryHasSid(req: { url?: string; originalUrl?: string }): boolean {
  for (const raw of [req.url, req.originalUrl]) {
    if (!raw) continue;
    const queryIndex = raw.indexOf('?');
    if (queryIndex === -1) continue;
    if (new URLSearchParams(raw.slice(queryIndex + 1)).has('sid')) return true;
  }
  return false;
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
