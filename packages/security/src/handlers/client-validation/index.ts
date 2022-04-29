import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { ConduitCommons, ConduitError } from '@conduitplatform/commons';
import { DatabaseProvider } from '@conduitplatform/grpc-sdk';
import { Client } from '../../models';
import * as bcrypt from 'bcrypt';
import { validatePlatform } from '../../utils/security';

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
    const securityConfig = await this.sdk.getConfigManager().get('security');
    const active = securityConfig.active;
    if (!active) {
      return next();
    }

    if (isNil(clientid)) {
      return next(ConduitError.unauthorized());
    }

    let key = await this.sdk.getState().getKey(`${clientid}`);
    if (key) {
      let [_clientsecret, _platform, _domain] = key.split(',');
      let validPlatform = validatePlatform(req,_platform,_domain)
      if (!validPlatform) {
        throw ConduitError.unauthorized();
      }
      let valid = clientsecret === _clientsecret;
      if (valid && validPlatform) {
        (req as any).conduit.clientId = clientid;
        return next();
      }
      // if not valid allow the execution to continue,
      // for the possibility of a secret refresh
    }
    let _client: { clientId: string; clientSecret: string, platform: string, domain: string };
    Client.getInstance()
      .findOne({ clientId: clientid },'clientSecret platform domain')
      .then((client: any) => {
        if (isNil(client)) { throw ConduitError.unauthorized(); }
        const validated = validatePlatform(req,client.platform,client.domain);
        if (!validated) { throw ConduitError.unauthorized(); }

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
        this.sdk.getState().setKey(`${clientid}`, `${clientsecret},${_client.platform},${_client.domain}`, 100000);
        next();
      })
      .catch(() => {
        next(ConduitError.unauthorized());
      });
  }
}
