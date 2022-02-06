import ConduitGrpcSdk from '@conduitplatform/conduit-grpc-sdk';
import ChatModule from './Chat';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}

const serviceAddress = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[0] : '0.0.0.0';
const servicePort = process.env.SERVICE_IP ? process.env.SERVICE_IP.split(':')[1] : undefined;

let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'chat');
let chat = new ChatModule(grpcSdk);
chat
  .initialize(servicePort)
  .then(() => {
    let url =
      (process.env.REGISTER_NAME === 'true' ? 'chat:' : `${ serviceAddress }:`) +
      chat.port;
    return grpcSdk.config.registerModule('chat', url);
  })
  .catch((err: Error) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return chat.activate();
  })
  .catch((err: Error) => {
    console.log('Failed to activate module');
    console.error(err);
  });
