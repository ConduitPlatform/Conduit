import { Request, Response, NextFunction, Application } from 'express';
import { ClientModel } from './models/Client';
import { isNil } from 'lodash';

let initialized = false;
let database: any;

export const initialize = (app: Application | any) => {
  if (!app) {
    throw new Error("No app provided")
  }
  database = app.conduit.database.getDbAdapter();
  database.createSchemaFromAdapter(ClientModel);

  return initialized = true;
};

export const middleware = (req: Request, res: Response, next: NextFunction) => {
  if (!initialized) {
    throw new Error('Security module not initialized');
  }

  const { clientid, clientsecret } = req.headers;
  if (isNil(clientid) || isNil(clientsecret)) {
    return res.status(401).json({message: 'Unauthorized'});
  }

  database.getSchema('Client')
    .findOne({clientId: clientid, clientSecret: clientsecret})
    .then(async( client: any )=> {
      if (isNil(client)) {
        return res.status(401).json({message: 'Unauthorized'});
      }
      delete req.headers.clientsecret;
      next();
    })
    .catch(next);
};
