import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';


export async function migrateCustomEndpoints(grpcSdk: ConduitGrpcSdk) {
  await grpcSdk.waitForExistence('database-provider');
  let errorMessage: string | null = null;
  const documents: any = await grpcSdk.databaseProvider!.findMany('CustomEndpoints', {})
    .catch((e: Error) => (errorMessage = e.message));
  if (!isNil(errorMessage)) {
    return Promise.reject(errorMessage);
  }

  for (const document of documents) {
    if (!isNil(document.queries) && isNil(document.query)) {
      document.query = { AND: document.queries };

      await grpcSdk.databaseProvider!.findByIdAndUpdate('CustomEndpoints', document._id, document)
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return Promise.reject(errorMessage);
      }
    }
  }
}
