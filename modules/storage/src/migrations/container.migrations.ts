import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

export async function migrateFoldersToContainers(grpcSdk: ConduitGrpcSdk) {
  await grpcSdk.waitForExistence('database-provider');
  const documents: any = await grpcSdk.databaseProvider!.findMany('File', {
    $or: [{ container: { $exists: false } }, { container: undefined }],
  });
  for (const document of documents) {
    document.container = document.folder;
    document.folder = null;
    let exists = await grpcSdk.databaseProvider!.findOne('_StorageContainer', {
      name: document.container,
    });
    if (!exists) {
      await grpcSdk.databaseProvider!.create('_StorageContainer', {
        name: document.container,
      });
    }
    await grpcSdk.databaseProvider!.findByIdAndUpdate('File', document._id, document);
  }
}
