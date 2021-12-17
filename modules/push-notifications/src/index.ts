import PushNotifications from './PushNotifications';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}

const serviceAddress = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[0] : '0.0.0.0';
const servicePort = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[1] : undefined;

let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'pushNotifications');
let notifications = new PushNotifications(grpcSdk);
notifications
  .initialize(servicePort)
  .then(() => {
    let url =
      (process.env.REGISTER_NAME === 'true' ? 'push-notifications:' : `${ serviceAddress }:`) +
      notifications.port;
    return grpcSdk.config.registerModule('pushNotifications', url);
  })
  .catch((err: Error) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return notifications.activate();
  })
  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
