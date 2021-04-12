import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { ConduitError, ConduitSDK } from '@quintessential-sft/conduit-sdk';
import { ClientModel } from '../../models/Client';

export class ClientValidator {
  constructor(private readonly database: any, private readonly sdk: ConduitSDK) {
    this.database.createSchemaFromAdapter(ClientModel);
  }

  async middleware(req: Request, res: Response, next: NextFunction) {
    if (isNil((req as any).conduit)) (req as any).conduit = {};
    if (req.path.indexOf('/hook') === 0 || req.path.indexOf('/admin') === 0) {
      return next();
    }

    if (
      (req.url === '/graphql' || req.url.startsWith('/swagger')) &&
      req.method === 'GET'
    ) {
      return next();
    }

    const { clientid, clientsecret } = req.headers;
    if (isNil(clientid) || isNil(clientsecret)) {
      return next(ConduitError.unauthorized());
    }

    let key = await this.sdk.getState().getKey(`${clientid}-${clientsecret}`);
    if (key) {
      (req as any).conduit.clientId = clientid;
      return next();
    }
    this.database
      .findOne('Client', { clientId: clientid, clientSecret: clientsecret })
      .then((client: any) => {
        if (isNil(client)) {
          throw ConduitError.unauthorized();
        }
        delete req.headers.clientsecret;
        (req as any).conduit.clientId = clientid;
        this.sdk.getState().setKey(`${clientid}-${clientsecret}`, true);
        next();
      })
      .catch(() => {
        next(ConduitError.unauthorized());
      });
  }
}
