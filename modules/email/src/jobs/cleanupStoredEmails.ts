import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { Config } from '../config/index.js';
import { SentEmail } from '../models/index.js';

interface File {
  _id: string;
  container: string;
  folder: string;
}
let grpcSdk: ConduitGrpcSdk | undefined = undefined;

export default async () => {
  if (!grpcSdk) {
    if (!process.env.CONDUIT_SERVER) throw new Error('No serverUrl provided!');
    grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'email', false);
    await grpcSdk.initialize();
    await grpcSdk.initializeEventBus();
    await grpcSdk.waitForExistence('database');
    SentEmail.getInstance(grpcSdk.database!);
  }
  const config = ConfigController.getInstance().config as Config;
  const storeInStorage = config.storeEmails.storage.enabled;
  const limit = config.storeEmails.cleanupSettings.limit;

  if (storeInStorage) {
    await grpcSdk.waitForExistence('storage');
    const fileIdsToDelete = await grpcSdk
      .database!.findMany<File>(
        'File',
        {
          folder: config.storeEmails.storage.folder,
          container: config.storeEmails.storage.container,
        },
        '_id',
        undefined,
        limit,
        'createdAt',
      )
      .then(r => r.map(emailFile => emailFile._id));
    for (const id of fileIdsToDelete) {
      await grpcSdk.storage!.deleteFile(id);
    }
  } else {
    const emailIdsToDelete = await SentEmail.getInstance()
      .findMany({}, '_id', undefined, limit, 'createdAt')
      .then(r => r.map(sentEmail => sentEmail._id));
    await SentEmail.getInstance().deleteMany({ _id: { $in: emailIdsToDelete } });
  }
};
