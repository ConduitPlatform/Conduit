import PushNotifications from './PushNotifications';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

let paths = require('./admin/admin.json');

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'pushnotifications');
let notifications = new PushNotifications(grpcSdk);

let url = notifications.url;
if (process.env.REGISTER_NAME === 'true') {
  url = 'storage:' + url.split(':')[1];
}

grpcSdk.config.registerModule('push-notifications', notifications.url).catch((err) => {
  console.error(err);
  process.exit(-1);
});
