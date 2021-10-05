import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import * as process from 'process';
import { AgoraRouter } from './router/Routes';

if (process.env.CONDUIT_URL) {
  let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_URL, 'my-custom-service');
  let wms = new AgoraRouter(grpcSdk);
  let url = wms.url;
  if (process.env.REGISTER_NAME === 'true') {
    url = 'my-custom-service:' + url.split(':')[1];
  }
  console.log('Registering url: ' + url);
  grpcSdk.config.registerModule('my-custom-service', url).catch((err) => {
    console.error(err);
    process.exit(-1);
  });
} else {
  throw new Error('Conduit server URL not provided');
}
