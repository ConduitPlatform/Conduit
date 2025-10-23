import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { EmailRecord } from '../models/index.js';
import { SandboxedJob } from 'bullmq';

let grpcSdk: ConduitGrpcSdk | undefined = undefined;

export default async (
  job: SandboxedJob<{ limit: number; deleteStorageFiles: boolean }>,
) => {
  if (!grpcSdk) {
    if (!process.env.CONDUIT_SERVER) throw new Error('No serverUrl provided!');
    grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'email', false);
    await grpcSdk.initialize();
    await grpcSdk.initializeEventBus();
    await grpcSdk.waitForExistence('database');
    EmailRecord.getInstance(grpcSdk.database!);
  }
  const { limit, deleteStorageFiles } = job.data;
  const emailsToDelete = await EmailRecord.getInstance().findMany(
    {},
    undefined,
    undefined,
    limit,
    'createdAt',
  );
  if (emailsToDelete.length === 0) return;
  const emailIdsToDelete = emailsToDelete.map(record => record._id);
  await EmailRecord.getInstance().deleteMany({ _id: { $in: emailIdsToDelete } });

  if (deleteStorageFiles) {
    await grpcSdk.waitForExistence('storage');
    const fileIdsToDelete = emailsToDelete
      .filter(record => record.contentFile)
      .map(record => record.contentFile);
    for (const id of fileIdsToDelete) {
      await grpcSdk.storage!.deleteFile(id);
    }
  }
};
