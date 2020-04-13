import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { AuthService } from '../services/auth';

export class AuthMiddleware {
  private readonly database: IConduitDatabase;

  constructor(
    private readonly sdk: ConduitSDK,
    private readonly authService: AuthService
  ) {
    this.database = sdk.getDatabase();
  }

  middleware(req: Request, res: Response, next: NextFunction) {
    const header = (req.headers['Authorization'] || req.headers['authorization']) as string;
    if (isNil(header)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const args = header.split(' ');

    const prefix = args[0];
    if (prefix !== 'Bearer') {
      return res.status(401).json({ error: 'The auth header must begin with Bearer' });
    }

    const token = args[1];
    if (isNil(token)) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const AccessToken = this.database.getSchema('AccessToken');
    const User = this.database.getSchema('User');

    AccessToken
      .findOne({ token, clientId: req.headers.clientid })
      .then(accessTokenDoc => {
        if (isNil(accessTokenDoc)) {
          return res.status(401).json({ error: 'Invalid token' });
        }

        const { config } = this.sdk as any;

        const decoded = this.authService.verify(token, config.get('authentication.jwtSecret'));
        if (isNil(decoded)) return res.status(401).json({ error: 'Invalid token' });

        const userId = decoded.id;

        User
          .findOne({ _id: userId })
          .then(user => {
            if (isNil(user)) {
              return res.status(404).json({ error: 'User not found' });
            }
            (req as any).conduit = {user};
            next();
          });
      })
      .catch(next);
  }
}
