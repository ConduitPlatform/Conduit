import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { StorageModule } from './Storage';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'storage');
let storage = new StorageModule(grpcSdk);
storage
  .initialize()
  .then(() => {
    let url =
      process.env.REGISTER_NAME === 'true' ? 'storage:' : '0.0.0.0:' + storage.port;
    return grpcSdk.config.registerModule('storage', url);
  })
  .catch((err: Error) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return storage.activate();
  })
  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
