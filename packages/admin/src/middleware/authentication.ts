import { isNil } from 'lodash';
import { verifyToken } from '../utils/auth';
import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const { conduit } = req.app as any;
  const { database, config } = conduit;

  const adminConfig = config.get('admin');

  const databaseAdapter = database.getDbAdapter();

  const AdminModel = databaseAdapter.getSchema('Admin');

  const tokenHeader = req.headers.authorization;
  if (isNil(tokenHeader)) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const args = tokenHeader.split(' ');
  if (args.length !== 2) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const [prefix, token] = args;
  if (prefix !== 'JWT') {
    return res.status(401).json({ error: 'The authorization header must begin with JWT' });
  }

  const decoded = verifyToken(token, adminConfig.auth.tokenSecret);
  const { id } = decoded;

  AdminModel.findOne({ _id: id })
    .then((admin: any) => {
      if (isNil(admin)) {
        return res.status(401).json({ error: 'No such user exists' });
      }
      (req as any).admin = admin;
      next();
    })
    .catch((error: Error) => {
      console.log(error);
      res.status(500).json({ error: 'Something went wrong' });
    });
}
