import { NextFunction, Request, Response } from 'express';
import { ClientModel } from './models/Client';
import { isNil } from 'lodash';
import { ConduitSDK, IConduitDatabase, IConduitSecurity, PlatformTypesEnum } from '@conduit/sdk';

class SecurityModule extends IConduitSecurity {

  private readonly database: IConduitDatabase;

  constructor(conduit: ConduitSDK) {
    super(conduit);

    this.database = conduit.getDatabase();
    this.database.createSchemaFromAdapter(ClientModel);

    conduit.getAdmin().registerRoute('POST', '/client',
      async (req: Request, res: Response, next: NextFunction) => {
        const { clientId, clientSecret, platform } = req.body;

        if (!Object.values(PlatformTypesEnum).includes(platform)) {
          return res.status(401).json({ error: 'Invalid platform' });
        }

        await this.database.getSchema('Client').create({
          clientId,
          clientSecret,
          platform
        });

        return res.json({ message: 'Client created' });
      });
  }

  authMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.path.indexOf('/hook/') === 0 || req.path.indexOf('/admin/') === 0) {
      return next();
    }

    if (req.path.indexOf('/graphql') === 0 && req.method === 'GET') {
      return next();
    }

    const { clientid, clientsecret } = req.headers;
    if (isNil(clientid) || isNil(clientsecret)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    this.database.getSchema('Client')
      .findOne({ clientId: clientid, clientSecret: clientsecret })
      .then(async (client: any) => {
        if (isNil(client)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        delete req.headers.clientsecret;
        next();
      })
      .catch(next);
  }


  adminMiddleware(req: Request, res: Response, next: NextFunction) {

    if (req.path.indexOf('/admin/') !== 0) {
      return next();
    }

    const masterkey = req.headers.masterkey;
    if (isNil(masterkey) || masterkey !== (req.app as any).conduit.config.get('admin.auth.masterkey'))
      return res.status(401).json({ error: 'Unauthorized' });

    return next();
  }
}

export = SecurityModule;
