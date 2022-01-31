import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { ConduitCommons, ConduitError } from '@conduitplatform/conduit-commons';
import { ClientModel } from '../../models/Client';
import * as bcrypt from 'bcrypt';
import { DatabaseProvider } from '@conduitplatform/conduit-grpc-sdk';

export class ClientValidator {
  prod = false;

  constructor(
    private readonly database: DatabaseProvider,
    private readonly sdk: ConduitCommons
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
    this.database.createSchemaFromAdapter(ClientModel);
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

    const { clientid, clientsecret } = req.headers;
    if (isNil(clientid) || isNil(clientsecret)) {
      return next(ConduitError.unauthorized());
    }

    let key = await this.sdk.getState().getKey(`${clientid}`);
    if (key) {
      let valid = await bcrypt.compare(clientsecret, key);
      if (valid) {
        (req as any).conduit.clientId = clientid;
        return next();
      }
      // if not valid allow the execution to continue,
      // for the possibility of a secret refresh
    }
    let _client: { clientId: string; clientSecret: string };
    this.database
      .findOne('Client', { clientId: clientid },'clientSecret')
      .then((client: any) => {
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
        this.sdk.getState().setKey(`${clientid}`, _client.clientSecret, 10000);
        next();
      })
      .catch(() => {
        next(ConduitError.unauthorized());
      });
  }
}
