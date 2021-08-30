import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import FormsModule from './Forms';

let paths = require('./admin/admin.json');

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'forms');
let forms = new FormsModule(grpcSdk);
forms
  .initialize()
  .then(() => {
    let url = process.env.REGISTER_NAME === 'true' ? 'forms:' : '0.0.0.0:' + forms.port;
    return grpcSdk.config.registerModule('forms', url);
  })
  .catch((err: Error) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return forms.activate();
  })
  .then(() => {
    return grpcSdk.admin.register(paths.functions);
  })
  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
