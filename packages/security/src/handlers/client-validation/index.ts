import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { ConduitCommons, ConduitError } from '@conduitplatform/commons';
import { ConfigController, DatabaseProvider } from '@conduitplatform/grpc-sdk';
import { Client } from '../../models';
import { validateClient } from '../../utils/security';
import { ValidationInterface } from '../../interfaces/ValidationInterface';

export class ClientValidator {
  prod = false;

  constructor(
    private readonly database: DatabaseProvider,
    private readonly sdk: ConduitCommons,
  ) {
    const self = this;
    sdk
      .getConfigManager()
      .get('core')
      .then((res) => {
        if (res.env === 'production') {
          self.prod = true;
        }
      });
  }

  async middleware(req: Request, res: Response, next: NextFunction) {
    if (isNil((req as any).conduit)) (req as any).conduit = {};
    const { clientid, clientsecret } = req.headers;
    // if incoming call is a webhook or an admin call
    if (req.path.indexOf('/hook') === 0 || req.path.indexOf('/admin') === 0) {
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

    const securityConfig = ConfigController.getInstance().config;
    if (!securityConfig.clientValidation.enabled) {
      (req as any).conduit.clientId = 'anonymous-client';
      delete req.headers.clientsecret;
      delete req.headers.clientid;
      return next();
    }

    if (isNil(clientid)) {
      return next(ConduitError.unauthorized());
    }

    let key = await this.sdk.getState().getKey(clientid as string);
    if (key) {
      let [_clientsecret, _platform, _domain] = key.split(',');
      let validPlatform = await validateClient(req,
        {
          clientSecret: _clientsecret,
          platform: _platform,
          domain: _domain,
        },
        true);
      if (validPlatform) {
        (req as any).conduit.clientId = clientid;
        return next();
      }
      // if not valid allow the execution to continue,
      // for the possibility of a secret refresh
    }
    Client.getInstance()
      .findOne({ clientId: clientid }, 'clientSecret platform domain')
      .then(async (client) => {
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
        (req as any).conduit.clientId = clientid;
        // expiry to force key refresh in redis so that keys can be revoked without redis restart
        this.sdk.getState().setKey(`${clientid}`, `${clientsecret},${valid.client!.platform},${valid.client!.domain}`, 100000);
        next();
      })
      .catch(() => {
        next(ConduitError.unauthorized());
      });
  }
}
