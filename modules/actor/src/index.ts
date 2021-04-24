import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import ActorModule from './Actor';

let paths = require('./admin/admin.json');

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'actor');
let actor = new ActorModule(grpcSdk);
let url = actor.url;
if (process.env.REGISTER_NAME === 'true') {
  url = 'actor:' + url.split(':')[1];
}
grpcSdk.config
  .registerModule('actor', url)
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    grpcSdk.admin.register(paths.functions);
  })
  .catch((err: Error) => {
    console.log('Failed to register admin routes for actor module!');
    console.error(err);
  });
