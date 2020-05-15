import ConduitGrpcSdk from '@conduit/grpc-sdk';
import {StorageModule} from './Storage';


// if (process.env.CONDUIT_SERVER) {
let grpcSdk = new ConduitGrpcSdk("0.0.0.0:55152");
let storage = new StorageModule(grpcSdk);
grpcSdk.config.registerModule('storage', storage.url).catch(err => {
  console.error(err)
  process.exit(-1);
});
// } else {
//     throw new Error("Conduit server URL not provided");
// }
