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

  // Update URLs for files in changed containers. sourceUrl is the provider URL;
  // the stored url may already be CDN-hosted and cannot recover the original host.
  let totalUpdated = 0;
  let totalSkippedUnchanged = 0;
  let totalSkippedMissingSourceUrl = 0;

  for (const container of changedContainers) {
    let updated = 0;
    let skippedUnchanged = 0;
    let skippedMissingSourceUrl = 0;
    try {
      const publicFiles = await File.getInstance().findMany({
        container,
        isPublic: true,
      });

      for (const file of publicFiles) {
        if (!file.sourceUrl) {
          skippedMissingSourceUrl++;
          continue;
        }
        const newUrl = applyCdnHost(file.sourceUrl, container);
        if (newUrl === file.url) {
          skippedUnchanged++;
          continue;
        }
        await File.getInstance().findByIdAndUpdate(file._id, {
          url: newUrl,
        });
        updated++;
      }

      totalUpdated += updated;
      totalSkippedUnchanged += skippedUnchanged;
      totalSkippedMissingSourceUrl += skippedMissingSourceUrl;
      logger.log(
        `Container "${container}": scanned ${publicFiles.length} public file(s), updated ${updated}, skipped ${skippedUnchanged} unchanged, skipped ${skippedMissingSourceUrl} without sourceUrl`,
      );
    } catch (error) {
      logger.error(
        `CDN migration failed for container "${container}" after updating ${updated}, skipped ${skippedUnchanged} unchanged and ${skippedMissingSourceUrl} without sourceUrl: ${
          (error as Error).message
        }`,
      );
      throw error;
    }
  }

  logger.log(
    `CDN configuration migration completed: updated ${totalUpdated}, skipped ${totalSkippedUnchanged} unchanged, skipped ${totalSkippedMissingSourceUrl} without sourceUrl`,
  );
}
