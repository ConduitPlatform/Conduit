import { Job, Processor } from 'bullmq';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { EmailRecord } from '../models/index.js';

export type CleanupStoredEmailsWorkerData = {
  limit: number;
  deleteStorageFiles: boolean;
};

export function createCleanupStoredEmailsProcessor(
  grpcSdk: ConduitGrpcSdk,
): Processor<CleanupStoredEmailsWorkerData> {
  return async (job: Job<CleanupStoredEmailsWorkerData>) => {
    const { limit, deleteStorageFiles } = job.data;
    const emailsToDelete = await EmailRecord.getInstance().findMany(
      {},
      { limit, sort: 'createdAt' },
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
}
