import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import SmsModule from './Sms';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}

const serviceAddress = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[0] : '0.0.0.0';
const servicePort = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[1] : undefined;

let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'sms');
let sms = new SmsModule(grpcSdk);
sms
  .initialize(servicePort)
  .then(() => {
    let url =
      (process.env.REGISTER_NAME === 'true' ? 'sms-provider:' : `${ serviceAddress }:`) +
      sms.port;
    return grpcSdk.config.registerModule('sms', url);
  })
  .catch((err: Error) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return sms.activate();
  })
  .catch((err: Error) => {
    console.log('Failed to activate module');
    console.error(err);
  });
