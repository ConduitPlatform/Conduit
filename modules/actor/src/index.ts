import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import ActorModule from './Actor';

let paths = require('./admin/admin.json');

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'actor');
let actor = new ActorModule(grpcSdk);
actor
  .initialize()
  .then(() => {
    let url = (process.env.REGISTER_NAME === 'true' ? 'actor:' : '0.0.0.0:') + actor.port;
    return grpcSdk.config.registerModule('actor', url);
  })
  .catch((err) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return actor.activate();
  })
  .then(() => {
    return grpcSdk.admin.register(paths.functions);
  })
  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
