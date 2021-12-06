import { Request, Response, NextFunction } from 'express';
import { isNil } from 'lodash';
import { ConduitCommons } from '@quintessential-sft/conduit-commons';

export function getAdminMiddleware(conduit: ConduitCommons) {
  return async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
    const masterkey = req.headers.masterkey;
    let master = process.env.masterkey ?? 'M4ST3RK3Y';
    if (isNil(masterkey) || masterkey !== master)
      return res.status(401).json({ error: 'Unauthorized' });
    next();
  }  
}
