import { DatabaseProvider } from './DatabaseProvider';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}

const serviceAddress = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[0] : '0.0.0.0';
const servicePort = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[1] : undefined;

let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'database');
let databaseProvider = new DatabaseProvider(grpcSdk);
databaseProvider
  .initialize(servicePort)
  .then(() => {
    let url =
      (process.env.REGISTER_NAME === 'true' ? 'database:' : `${ serviceAddress }:`) +
      databaseProvider.port;
    return grpcSdk.config.registerModule('database', url);
  })
  .catch((err: Error) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return databaseProvider.activate();
  })
  .catch((err: Error) => {
    console.log('Failed to activate module');
    console.error(err);
  });
