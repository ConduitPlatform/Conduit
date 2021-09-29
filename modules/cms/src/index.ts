import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { CMS } from './CMS';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}

let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'cms');
let cms = new CMS(grpcSdk);
cms
  .initialize()
  .then(() => {
    let url = (process.env.REGISTER_NAME === 'true' ? 'cms:' : '0.0.0.0:') + cms.port;
    return grpcSdk.config.registerModule('cms', url);
  })
  .catch((err) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return cms.activate();
  })
  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
