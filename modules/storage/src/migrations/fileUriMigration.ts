import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { buildFileUri } from '../utils/index.js';
import { _StorageContainer, File } from '../models/index.js';

export const FILE_URI_MIGRATION_BATCH_SIZE = 200;

export function filesNeedingUriMigrationQuery(afterId?: string) {
  return {
    isPublic: true,
    $or: [{ uri: { $exists: false } }, { uri: null }, { uri: '' }],
    ...(afterId ? { _id: { $gt: afterId } } : {}),
  };
}

export async function migrateFileUriReferences(): Promise<void> {
  const logger = ConduitGrpcSdk.Logger;
  const containerIsPublic = await loadContainerPublicity();
  let updated = 0;
  let scanned = 0;
  let lastId: string | undefined;

  try {
    for (;;) {
      const batch = await File.getInstance().findMany(
        filesNeedingUriMigrationQuery(lastId),
        {
          skip: 0,
          limit: FILE_URI_MIGRATION_BATCH_SIZE,
          sort: { _id: 1 },
          select: '_id container url sourceUrl uri',
        },
      );
      if (batch.length === 0) {
        break;
      }

      for (const file of batch) {
        const isContainerPublic = containerIsPublic.get(file.container) ?? false;
        const update: Record<string, string> = {
          uri: buildFileUri(file._id),
        };
        if (!isContainerPublic) {
          update.url = '';
          update.sourceUrl = '';
        }
        await File.getInstance().findByIdAndUpdate(file._id, update);
        updated++;
      }

      scanned += batch.length;
      lastId = batch[batch.length - 1]._id;
      logger.log(
        `File URI migration progress: updated ${updated} / scanned ${scanned} public file(s)`,
      );

      if (batch.length < FILE_URI_MIGRATION_BATCH_SIZE) {
        break;
      }
    }

    logger.log(
      updated === 0
        ? 'No public files required URI migration'
        : `File URI migration completed for ${updated} public file(s)`,
    );
  } catch (error) {
    logger.error(`File URI migration failed: ${(error as Error).message}`);
    throw error;
  }
}

async function loadContainerPublicity(): Promise<Map<string, boolean>> {
  const containerIsPublic = new Map<string, boolean>();
  let lastId: string | undefined;

  for (;;) {
    const batch = await _StorageContainer.getInstance().findMany(
      lastId ? { _id: { $gt: lastId } } : {},
      {
        skip: 0,
        limit: FILE_URI_MIGRATION_BATCH_SIZE,
        sort: { _id: 1 },
        select: '_id name isPublic',
      },
    );
    if (batch.length === 0) {
      break;
    }
    for (const container of batch) {
      containerIsPublic.set(container.name, container.isPublic ?? false);
    }
    lastId = batch[batch.length - 1]._id;
    if (batch.length < FILE_URI_MIGRATION_BATCH_SIZE) {
      break;
    }
  }

  return containerIsPublic;
}
