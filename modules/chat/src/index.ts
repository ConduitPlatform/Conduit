import ConduitGrpcSdk from '@conduitplatform/conduit-grpc-sdk';
import ChatModule from './Chat';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}

let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'chat');
let chat = new ChatModule(grpcSdk);
chat
  .initialize()
  .then(() => {
    let url = (process.env.REGISTER_NAME === 'true' ? 'chat:' : '0.0.0.0:') + chat.port;
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
    console.log('Failed to active module');
    console.error(err);
  });
