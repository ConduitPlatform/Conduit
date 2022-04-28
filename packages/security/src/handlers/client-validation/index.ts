import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { ConduitCommons, ConduitError } from '@conduitplatform/commons';
import { DatabaseProvider } from '@conduitplatform/grpc-sdk';
import { Client } from '../../models';
import * as bcrypt from 'bcrypt';

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
    const securityConfig = await this.sdk.getConfigManager().get('security');
    const active = securityConfig.active;
    if (!active) {
      return next();
    }

    const { clientid, clientsecret } = req.headers;
    if (isNil(clientid) || isNil(clientsecret)) {
      return next(ConduitError.unauthorized());
    }

    let key = await this.sdk.getState().getKey(`${clientid}`);
    if (key) {
      let valid = clientsecret === key;
      if (valid) {
        (req as any).conduit.clientId = clientid;
        return next();
      }
      // if not valid allow the execution to continue,
      // for the possibility of a secret refresh
    }
    let _client: { clientId: string; clientSecret: string };
    Client.getInstance()
      .findOne({ clientId: clientid })
      .then((client: any) => {
        if (client.platform === 'WEB' && client.domain) {
          const isRegex = (client.domain).includes('*');
          let match: boolean;
          if (isRegex) {
            match = (client.domain).test(req.hostname);  // check if the regex matches with the hostname
          }
          match = (client.domain === req.hostname);
          return match;
        }
        if (isNil(client)) {
          throw ConduitError.unauthorized();
        }
        _client = client;
        return bcrypt.compare(clientsecret, client.clientSecret);
      })
      .then((valid: boolean) => {
        if (!valid) {
          throw ConduitError.unauthorized();
        }
        delete req.headers.clientsecret;
        (req as any).conduit.clientId = clientid;
        // expiry to force key refresh in redis so that keys can be revoked without redis restart
        this.sdk.getState().setKey(`${clientid}`, clientsecret, 100000);
        next();
      })
      .catch(() => {
        next(ConduitError.unauthorized());
      });
  }
}
