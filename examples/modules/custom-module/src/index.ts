import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import CustomModule from './CustomModule';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}

const serviceAddress = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[0] : '0.0.0.0';
const servicePort = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[1] : undefined;

const grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'customModule');
const module = new CustomModule(grpcSdk);
module
  .initialize(servicePort)
  .then(() => {
    let url =
      (process.env.REGISTER_NAME === 'true' ? 'custom-module:' : `${ serviceAddress }:`) +
      module.port;
    return grpcSdk.config.registerModule('custom-module', url);
  })
  .catch((err: Error) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return module.activate();
  })
  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
