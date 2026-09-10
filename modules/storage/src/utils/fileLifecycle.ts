import { ConduitGrpcSdk, GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { IStorageProvider, ObjectStat } from '../interfaces/index.js';
import { File } from '../models/index.js';
import {
  emitContainerDeleted,
  emitFileDeleteMany,
  emitFileReady,
  emitFileUpdate,
  emitFolderDeleted,
} from './fileEvents.js';
import { objectPathForFile } from './fileBytes.js';
import {
  applyObjectStatToFile,
  isFileBytesReady,
  objectIsPendingPlaceholder,
} from './fileUploadState.js';

const FILE_DELETE_SCAN_BATCH = 500;

function updateFileMetrics(currentSize: number, newSize: number) {
  const fileSizeDiff = Math.abs(currentSize - newSize);
  if (newSize > currentSize) {
    ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', fileSizeDiff);
  } else if (newSize < currentSize) {
    ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', fileSizeDiff);
  }
}

export async function safeStat(
  storageProvider: IStorageProvider,
  container: string,
  fileName: string,
): Promise<ObjectStat | undefined> {
  try {
    const result = await storageProvider.container(container).stat(fileName);
    if (result instanceof Error || !result.exists) {
      return undefined;
    }
    return result;
  } catch {
    return undefined;
  }
}

export async function completeFileUpload(
  storageProvider: IStorageProvider,
  file: File,
  grpcSdk?: ConduitGrpcSdk,
): Promise<File> {
  const fileName = objectPathForFile(file);
  const objectStat = await storageProvider.container(file.container).stat(fileName);
  if (objectStat instanceof Error) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      objectStat.message || 'Unable to verify uploaded object',
    );
  }
  if (!objectStat.exists) {
    throw new GrpcError(status.FAILED_PRECONDITION, 'Upload is not complete');
  }

  const stillPlaceholder = await objectIsPendingPlaceholder(file, objectStat, () =>
    storageProvider.container(file.container).get(fileName),
  );
  if (stillPlaceholder) {
    throw new GrpcError(status.FAILED_PRECONDITION, 'Upload is not complete');
  }

  const nextFields = applyObjectStatToFile(file, objectStat);
  const previousVersion = file.contentVersion;
  const wasReady = isFileBytesReady(file);
  const unchanged =
    wasReady &&
    previousVersion != null &&
    previousVersion === nextFields.contentVersion &&
    file.size === nextFields.size;

  if (unchanged) {
    return file;
  }

  const updatedFile = (await File.getInstance().findByIdAndUpdate(file._id, {
    ...nextFields,
    mimeType: nextFields.mimeType ?? file.mimeType,
  })) as File;
  updateFileMetrics(file.size, nextFields.size);
  if (wasReady) {
    emitFileUpdate(grpcSdk, updatedFile);
  } else {
    emitFileReady(grpcSdk, updatedFile);
  }
  return updatedFile;
}

export async function collectAndDeleteFiles(
  query: Indexable,
  grpcSdk: ConduitGrpcSdk | undefined,
  cleanup:
    | { type: 'folder'; id: string; name: string; container: string }
    | { type: 'container'; id: string; name: string },
): Promise<string[]> {
  const ids: string[] = [];
  let lastId: string | undefined;
  let sizeTotal = 0;

  for (;;) {
    const batch = await File.getInstance().findMany(
      lastId ? { $and: [query, { _id: { $gt: lastId } }] } : query,
      {
        skip: 0,
        limit: FILE_DELETE_SCAN_BATCH,
        sort: { _id: 1 },
        select: '_id size',
      },
    );
    if (batch.length === 0) {
      break;
    }
    for (const file of batch) {
      ids.push(file._id);
      sizeTotal += file.size ?? 0;
    }
    lastId = batch[batch.length - 1]._id;
    if (batch.length < FILE_DELETE_SCAN_BATCH) {
      break;
    }
  }

  if (ids.length > 0) {
    await File.getInstance().deleteMany(query);
    ConduitGrpcSdk.Metrics?.decrement('files_total', ids.length);
    if (sizeTotal > 0) {
      ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', sizeTotal);
    }
    emitFileDeleteMany(grpcSdk, ids, {
      container: cleanup.type === 'folder' ? cleanup.container : cleanup.name,
      folder: cleanup.type === 'folder' ? cleanup.name : undefined,
    });
  }

  if (cleanup.type === 'folder') {
    emitFolderDeleted(grpcSdk, {
      id: cleanup.id,
      name: cleanup.name,
      container: cleanup.container,
    });
  } else {
    emitContainerDeleted(grpcSdk, { id: cleanup.id, name: cleanup.name });
  }

  return ids;
}
