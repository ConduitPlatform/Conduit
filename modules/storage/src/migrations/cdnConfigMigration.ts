import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { File } from '../models/index.js';
import { applyCdnHost } from '../utils/index.js';

export type CdnConfiguration = Record<string, string>;

/**
 * Compares two CDN configurations and returns the list of containers
 * that have actually changed (added, removed, or value modified).
 * Order-independent comparison.
 */
export function getChangedContainers(
  previousConfig: CdnConfiguration,
  currentConfig: CdnConfiguration,
): string[] {
  const changedContainers: string[] = [];
  const allContainers = new Set([
    ...Object.keys(previousConfig),
    ...Object.keys(currentConfig),
  ]);

  for (const container of allContainers) {
    const prevValue = previousConfig[container];
    const currValue = currentConfig[container];

    // Changed if: value differs, was added, or was removed
    if (prevValue !== currValue) {
      changedContainers.push(container);
    }
  }

  return changedContainers;
}

/**
 * Checks if two CDN configurations are equivalent (order-independent).
 */
export function cdnConfigsAreEqual(
  configA: CdnConfiguration | undefined,
  configB: CdnConfiguration | undefined,
): boolean {
  const a = configA ?? {};
  const b = configB ?? {};

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  // Different number of keys = not equal
  if (keysA.length !== keysB.length) {
    return false;
  }

  // Check each key has the same value
  for (const key of keysA) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Migration to update file URLs when CDN configuration changes.
 * Compares the new CDN config with the previous one and updates affected files.
 */
export async function migrateCdnConfigChanges(
  grpcSdk: ConduitGrpcSdk,
  previousCdnConfig: CdnConfiguration,
): Promise<void> {
  const logger = ConduitGrpcSdk.Logger;
  const currentConfig = ConfigController.getInstance().config;
  const currentCdnConfig = (currentConfig.cdnConfiguration ?? {}) as CdnConfiguration;

  // Find containers with changed CDN configuration (order-independent)
  const changedContainers = getChangedContainers(previousCdnConfig, currentCdnConfig);

  if (changedContainers.length === 0) {
    return;
  }

  logger.log(
    `CDN configuration changed for ${
      changedContainers.length
    } container(s): ${changedContainers.join(', ')}`,
  );

  // Update URLs for files in changed containers
  for (const container of changedContainers) {
    try {
      // Find all public files in this container
      const allFiles = await File.getInstance().findMany({
        container,
        isPublic: true,
      });

      // Filter to only files with a sourceUrl
      const files = allFiles.filter(f => f.sourceUrl);

      if (files.length === 0) {
        logger.log(`No public files to update in container "${container}"`);
        continue;
      }

      logger.log(`Updating ${files.length} file(s) in container "${container}"`);

      // Update each file's URL with the new CDN host
      for (const file of files) {
        const newUrl = applyCdnHost(file.sourceUrl, container);
        await File.getInstance().findByIdAndUpdate(file._id, {
          url: newUrl,
        });
      }

      logger.log(`Successfully updated files in container "${container}"`);
    } catch (error) {
      logger.error(
        `Failed to update files in container "${container}": ${(error as Error).message}`,
      );
    }
  }

  logger.log('CDN configuration migration completed');
}
