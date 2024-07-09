import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { Config } from '../config/index.js';
import { SentEmail } from '../models/index.js';
import { SandboxedJob } from 'bullmq';

interface File {
  _id: string;
  container: string;
  folder: string;
}
let grpcSdk: ConduitGrpcSdk | undefined = undefined;

export default async (job: SandboxedJob<{ config: Config }>) => {
  if (!grpcSdk) {
    if (!process.env.CONDUIT_SERVER) throw new Error('No serverUrl provided!');
    grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'email', false);
    await grpcSdk.initialize();
    await grpcSdk.initializeEventBus();
    await grpcSdk.waitForExistence('database');
    SentEmail.getInstance(grpcSdk.database!);
  }
  const config = job.data.config;
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
    if (emailIdsToDelete.length === 0) return;
    await SentEmail.getInstance().deleteMany({ _id: { $in: emailIdsToDelete } });
  }
};
