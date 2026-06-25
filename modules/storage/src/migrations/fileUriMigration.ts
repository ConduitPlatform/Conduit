import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { buildFileUri } from '../utils/index.js';
import { _StorageContainer, File } from '../models/index.js';

export async function migrateFileUriReferences(): Promise<void> {
  const logger = ConduitGrpcSdk.Logger;

  try {
    const publicFiles = await File.getInstance().findMany({ isPublic: true });
    if (publicFiles.length === 0) {
      logger.log('No public files found for URI migration');
      return;
    }

    const containers = await _StorageContainer.getInstance().findMany({});
    const containerIsPublic = new Map(
      containers.map(container => [container.name, container.isPublic ?? false]),
    );

    let updated = 0;
    for (const file of publicFiles) {
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

    logger.log(`File URI migration completed for ${updated} public file(s)`);
  } catch (error) {
    logger.error(`File URI migration failed: ${(error as Error).message}`);
  }
}
