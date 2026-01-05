import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { IStorageProvider } from '../interfaces/index.js';
import { _StorageContainer } from '../models/index.js';

/**
 * Migration to update existing public containers to actually be public on the cloud provider.
 * This is needed because previously, containers were only marked as public in the database
 * but not actually configured as public on the cloud storage provider.
 */
export async function migratePublicContainers(
  grpcSdk: ConduitGrpcSdk,
  storageProvider: IStorageProvider,
): Promise<void> {
  const logger = ConduitGrpcSdk.Logger;

  try {
    // Find all containers marked as public in the database
    const publicContainers = await _StorageContainer.getInstance().findMany({
      isPublic: true,
    });

    if (publicContainers.length === 0) {
      logger.log('No public containers found to migrate');
      return;
    }

    logger.log(
      `Found ${publicContainers.length} public container(s) to migrate to cloud provider`,
    );

    for (const container of publicContainers) {
      try {
        // Check if container exists on the provider
        const exists = await storageProvider.containerExists(container.name);
        if (!exists) {
          logger.warn(
            `Container "${container.name}" does not exist on cloud provider, skipping`,
          );
          continue;
        }

        // Set the container to public on the cloud provider
        await storageProvider.setContainerPublicAccess(container.name, true);
        logger.log(
          `Successfully set public access for container "${container.name}" on cloud provider`,
        );
      } catch (error) {
        logger.error(
          `Failed to set public access for container "${container.name}": ${
            (error as Error).message
          }`,
        );
      }
    }

    logger.log('Public container migration completed');
  } catch (error) {
    logger.error(`Public container migration failed: ${(error as Error).message}`);
  }
}
