import { isNil } from 'lodash';
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import * as grpc from 'grpc';

export class NotificationTokensHandler {
  private database: any;

  constructor(grpcSdk: ConduitGrpcSdk) {
    this.initDb(grpcSdk);
  }

  async initDb(grpcSdk: ConduitGrpcSdk) {
    while (!grpcSdk.databaseProvider) {
      await grpcSdk.refreshModules();
    }
    this.database = grpcSdk.databaseProvider;
  }

  async setNotificationToken(call: any, callback: any) {
    const { token, platform } = JSON.parse(call.request.params);
    if (isNil(token) || isNil(platform)) {
      return callback({code: grpc.status.INVALID_ARGUMENT, message: 'Required fields are missing'});
    }
    const userId = JSON.parse(call.request.context).user._id;

    let errorMessage = null;
    this.database.findOne('NotificationToken',{userId, platform})
      .then((oldToken: any) => {
        if (!isNil(oldToken)) return this.database.deleteOne('NotificationToken', oldToken);
      })
      .catch((e: any) => errorMessage = e.message);
    if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

    const newTokenDocument = await this.database.create('NotificationToken',{
      userId,
      token,
      platform
    }).catch((e: any) => errorMessage = e.message);
    if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

    return callback(null, {result: JSON.stringify({ message: 'Push notification token created', newTokenDocument })});
  }

}
