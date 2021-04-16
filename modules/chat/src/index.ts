import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import ChatModule from './Chat';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}

let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'chat');
let chat = new ChatModule(grpcSdk);
let url = chat.url;
if (process.env.REGISTER_NAME === 'true') {
  url = 'chat:' + url.split(':')[1];
}
grpcSdk.config.registerModule('chat', url).catch((err: any) => {
  console.error(err);
  process.exit(-1);
});
