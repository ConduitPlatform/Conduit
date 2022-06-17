import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConfigController,
  DatabaseProvider,
  ConduitError,
  ConduitModelOptions,
} from '@conduitplatform/grpc-sdk';
import { Client } from '../../../models';
import { validateClient } from '../../utils';
import { ValidationInterface } from '../../interfaces/ValidationInterface';

export class ClientValidator {
  prod = false;
  database: DatabaseProvider;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.database = this.grpcSdk.database!;
    const self = this;
    this.grpcSdk.config.get('core').then(res => {
      if (res.env === 'production') {
        self.prod = true;
      }
    });
  }

  async middleware(req: Request, res: Response, next: NextFunction) {
    if (isNil((req as ConduitModelOptions).conduit))
      (req as ConduitModelOptions).conduit = {};
    const { clientid, clientsecret } = req.headers;
    // Exclude webhooks, admin calls and http pings
    if (req.path.indexOf('/hook') === 0 || ['/', '/health'].includes(req.path)) {
      return next();
    }

    // check gql explorer and swagger access
    if (
      (req.url === '/graphql' || req.url.startsWith('/swagger')) &&
      req.method === 'GET'
    ) {
      // disabled swagger and gql explorer access on production
      if (this.prod) return next(ConduitError.unauthorized());
      return next();
    }

    const securityConfig = ConfigController.getInstance().config.security;
    if (!securityConfig.clientValidation.enabled) {
      (req as ConduitModelOptions).conduit!.clientId = 'anonymous-client';
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
        (req as ConduitModelOptions).conduit!.clientId = clientid;
        return next();
      }
      // if not valid allow the execution to continue,
      // for the possibility of a secret refresh
    }
    Client.getInstance()
      .findOne({ clientId: clientid }, 'clientSecret platform domain')
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
        (req as ConduitModelOptions).conduit!.clientId = clientid;
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
