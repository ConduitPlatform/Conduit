import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import PaymentsModule from './Payments';

if (!process.env.CONDUIT_SERVER) {
  throw new Error('Conduit server URL not provided');
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'payments');
let payments = new PaymentsModule(grpcSdk);
payments
  .initialize()
  .then(() => {
    let url =
      (process.env.REGISTER_NAME === 'true' ? 'payments-provider:' : '0.0.0.0:') +
      payments.port;

    return grpcSdk.config.registerModule('payments', url);
  })
  .catch((err: Error) => {
    console.log('Failed to initialize server');
    console.error(err);
    process.exit(-1);
  })
  .then(() => {
    return payments.activate();
  })
  .catch((err: Error) => {
    console.log('Failed to active module');
    console.error(err);
  });
