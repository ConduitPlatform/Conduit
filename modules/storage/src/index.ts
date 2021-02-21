import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { StorageModule } from './Storage';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'storage');
let storage = new StorageModule(grpcSdk);
let url = storage.url;
if (process.env.REGISTER_NAME === 'true') {
  url = 'storage:' + url.split(':')[1];
}

grpcSdk.config
  .registerModule('storage', storage.url)
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    grpcSdk.router.register(storage.routes);
  })
  .catch((err: Error) => {
    console.log('Failed to register routes for storage module!');
    console.error(err);
  });
