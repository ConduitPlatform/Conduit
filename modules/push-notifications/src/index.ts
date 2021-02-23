import PushNotifications from './PushNotifications';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

let paths = require('./admin/admin.json');

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'pushnotifications');
let notifications = new PushNotifications(grpcSdk);
grpcSdk.config
  .registerModule('push-notifications', notifications.url)
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    grpcSdk.admin.register(paths.functions);
  })
  .catch((err: Error) => {
    console.log('Failed to register admin routes for push-notifications module!');
    console.error(err);
  });
