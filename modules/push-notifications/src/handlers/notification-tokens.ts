import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';

export class NotificationTokensHandler {
  private database: any;

  constructor(grpcSdk: ConduitGrpcSdk) {
    this.initDb(grpcSdk);
  }

  async initDb(grpcSdk: ConduitGrpcSdk) {
    await grpcSdk.waitForExistence('database-provider');
    this.database = grpcSdk.databaseProvider;
  }

  async setNotificationToken(call: RouterRequest, callback: RouterResponse) {
    const { token, platform } = JSON.parse(call.request.params);
    if (isNil(token) || isNil(platform)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });
    }
    const context = JSON.parse(call.request.context);
    if (isNil(context) || isNil(context.user))
      return callback({ code: status.UNAUTHENTICATED, message: 'Unauthorized' });
    const userId = context.user._id;

    let errorMessage = null;
    this.database
      .findOne('NotificationToken', { userId, platform })
      .then((oldToken: any) => {
        if (!isNil(oldToken))
          return this.database.deleteOne('NotificationToken', oldToken);
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    const newTokenDocument = await this.database
      .create('NotificationToken', {
        userId,
        token,
        platform,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, {
      result: JSON.stringify({
        message: 'Push notification token created',
        newTokenDocument,
      }),
    });
  }
}
