import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import EmailModule from './Email';
import process from 'process';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}
// register module
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'email');
let email = new EmailModule(grpcSdk);
email
  .initialize()
  .then(() => {
    let url =
      (process.env.REGISTER_NAME === 'true' ? 'email-provider:' : '0.0.0.0:') +
      email.port;
    return grpcSdk.config.registerModule('email', url);
  })
  .catch((err: Error) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return email.activate();
  })

  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
