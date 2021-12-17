import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import ActorModule from './Actor';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}

const serviceAddress = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[0] : '0.0.0.0';
const servicePort = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[1] : undefined;

let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'actor');
let actor = new ActorModule(grpcSdk);
actor
  .initialize(servicePort)
  .then(() => {
    let url =
      (process.env.REGISTER_NAME === 'true' ? 'actor:' : `${ serviceAddress }:`) +
      actor.port;
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
  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
