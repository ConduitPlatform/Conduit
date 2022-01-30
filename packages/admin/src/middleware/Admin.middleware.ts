import { Request, Response, NextFunction } from 'express';
import { isNil } from 'lodash';
import { ConduitCommons } from '@conduitplatform/conduit-commons';
import { isDev } from '../utils/middleware';

export function getAdminMiddleware(conduit: ConduitCommons) {
  return async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
    if ( // Excluded routes
      (req.originalUrl.indexOf('/admin/swagger') === 0 && await isDev(conduit))
    ) {
      return next();
    }
    const masterkey = req.headers.masterkey;
    if (!process.env.masterkey || process.env.masterkey.length === 0) {
      console.warn('!Security issue!: Master key not set, defaulting to insecure string');
    }
    let master = process.env.masterkey ?? 'M4ST3RK3Y';
    if (isNil(masterkey) || masterkey !== master)
      return res.status(401).json({ error: 'Unauthorized' });
    next();
  }
}
