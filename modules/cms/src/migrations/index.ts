import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { migrateCustomEndpoints } from './customEndpoint.schema.migrations';

export async function migrate(grpcSdk: ConduitGrpcSdk) {
  await migrateCustomEndpoints(grpcSdk)
    .then(() => {
      console.log('customEndpoints migration complete');
    })
    .catch(console.error);
}
