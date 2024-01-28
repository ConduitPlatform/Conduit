import { NextFunction, Response } from 'express';
import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitError,
  DatabaseProvider,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { Client } from '../../../models';
import { validateClient } from '../../utils';
import { ValidationInterface } from '../../interfaces/ValidationInterface';
import { ConduitRequest } from '@conduitplatform/hermes';

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
    const { clientid, clientsecret } = req.headers;
    // Exclude webhooks, admin calls and http pings
    if (req.path.indexOf('/hook') === 0 || ['/', '/ready'].includes(req.path)) {
      return next();
    }

    // check gql explorer and swagger access
    if (
      (req.url === '/graphql' ||
        req.url.startsWith('/swagger') ||
        req.url.startsWith('/reference')) &&
      req.method === 'GET'
    ) {
      // disabled swagger and gql explorer access on production
      const isProd = await this.isProd();
      if (isProd) return next(ConduitError.unauthorized());
      return next();
    }

    const securityConfig = ConfigController.getInstance().config.security;
    if (!securityConfig.clientValidation) {
      req.conduit!.clientId = 'anonymous-client';
      delete req.headers.clientsecret;
      delete req.headers.clientid;
      return next();
    }

    if (isNil(clientid)) {
      return next(ConduitError.unauthorized());
    }

    const key = await this.grpcSdk.state!.getKey(clientid as string);
    if (key) {
      const [_clientsecret, _platform, _domain] = key.split(',');
      const validPlatform = await validateClient(
        req,
        {
          clientSecret: _clientsecret,
          platform: _platform,
          domain: _domain,
        },
        true,
      );
      if (validPlatform) {
        req.conduit!.clientId = clientid;
        return next();
      }
      // if not valid allow the execution to continue,
      // for the possibility of a secret refresh
    }
    Client.getInstance()
      .findOne({ clientId: clientid as string }, 'clientSecret platform domain')
      .then(async client => {
        if (isNil(client)) {
          return {
            validated: false,
          };
        }
        return {
          validated: await validateClient(req, client, false),
          client: client,
        };
      })
      .then((valid: ValidationInterface) => {
        if (!valid.validated) {
          throw ConduitError.unauthorized();
        }
        delete req.headers.clientsecret;
        req.conduit!.clientId = clientid;
        // expiry to force key refresh in redis so that keys can be revoked without redis restart
        this.grpcSdk.state!.setKey(
          `${clientid}`,
          `${clientsecret},${valid.client!.platform},${valid.client!.domain}`,
          100000,
        );
        next();
      })
      .catch(() => {
        next(ConduitError.unauthorized());
      });
  }
}
