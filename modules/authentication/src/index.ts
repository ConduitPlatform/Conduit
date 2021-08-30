import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import AuthenticationModule from './Authentication';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}

let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'authentication');
let authentication = new AuthenticationModule(grpcSdk);
authentication
  .initialize()
  .then(() => {
    let url = process.env.REGISTER_NAME === 'true' ? 'authentication' : '0.0.0.0:';
    url += authentication.port;
    return grpcSdk.config.registerModule('authentication', url);
  })
  .catch((err: Error) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return authentication.activate();
  })
  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
