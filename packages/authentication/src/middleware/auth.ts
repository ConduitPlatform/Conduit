import { isNil } from 'lodash';
import { ConduitError, ConduitRouteParameters, ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { AuthService } from '../services/auth';

export class AuthMiddleware {
  private readonly database: IConduitDatabase;

  constructor(
    private readonly sdk: ConduitSDK,
    private readonly authService: AuthService
  ) {
    this.database = sdk.getDatabase();
  }

  middleware(request: ConduitRouteParameters): Promise<any> {
    return new Promise((resolve, reject) => {
      const header = (request.headers['Authorization'] || request.headers['authorization']) as string;
      if (isNil(header)) {
        throw new ConduitError('UNAUTHORIZED', 401, 'Unauthorized');
      }
      const args = header.split(' ');

      const prefix = args[0];
      if (prefix !== 'Bearer') {
        throw new ConduitError('UNAUTHORIZED', 401, 'The auth header must begin with Bearer');
      }

      const token = args[1];
      if (isNil(token)) {
        throw new ConduitError('UNAUTHORIZED', 401, 'No token provided');
      }

      const AccessToken = this.database.getSchema('AccessToken');
      const User = this.database.getSchema('User');

      AccessToken
        .findOne({ token, clientId: (request as any).context.clientId })
        .then(accessTokenDoc => {
          if (isNil(accessTokenDoc)) {
            throw new ConduitError('UNAUTHORIZED', 401, 'Invalid token');
          }

          const { config } = this.sdk as any;

          const decoded = this.authService.verify(token, config.get('authentication.jwtSecret'));
          if (isNil(decoded)) {
            throw new ConduitError('UNAUTHORIZED', 401, 'Invalid token');
          }

          const userId = decoded.id;
          User
            .findOne({ _id: userId })
            .then(user => {
              if (isNil(user)) {
                throw new ConduitError('NOT_FOUND', 404, 'User not found');
              }
              (request as any).context.user = user;
            });
        });
      resolve("ok");
    });

  }
}
