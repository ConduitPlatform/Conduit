import { Request, Response, NextFunction, Application } from 'express';
import { ClientModel } from './models/Client';

let initialized = false;
let database;

export const initialize = (app: Application | any, config: any) => {
  if (config && !Object.prototype.toString.call(config)) {
    throw new Error("Malformed config provided")
  }

  if (!app) {
    throw new Error("No app provided")
  }
  database = app.conduit.database.getDbAdapter();
  database.createSchemaFromAdapter(ClientModel);

  initialized = true;
};

export const middleware = (req: Request, res: Response, next: NextFunction) => {
  if (!initialized) {
    throw new Error("Authentication module not initialized");
  }

  return;
};
