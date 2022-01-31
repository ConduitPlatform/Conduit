import ConduitGrpcSdk from '@conduitplatform/conduit-grpc-sdk';
import SmsModule from './Sms';

let paths = require('./admin/admin.json');

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'sms');
let sms = new SmsModule(grpcSdk);
sms
  .initialize()
  .then(() => {
    let url =
      (process.env.REGISTER_NAME === 'true' ? 'sms-provider:' : '0.0.0.0:') + sms.port;
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
  .then(() => {
    return grpcSdk.admin.register(paths.functions);
  })
  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
