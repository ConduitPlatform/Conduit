import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  RouterRequest,
  RouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { NotificationToken } from '../models';

export class NotificationTokensHandler {

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
    NotificationToken.getInstance()
      .findOne({ userId, platform })
      .then((oldToken: any) => {
        if (!isNil(oldToken))
          return NotificationToken.getInstance().deleteOne(oldToken);
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    const newTokenDocument = await NotificationToken.getInstance()
      .create({
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
