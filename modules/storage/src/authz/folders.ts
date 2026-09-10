import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';
import { IStorageProvider } from '../interfaces/index.js';
import { _StorageContainer, _StorageFolder } from '../models/index.js';
import { getNestedPaths } from '../utils/index.js';
import { createFolderOwnerRelations } from './relations.js';
import {
  isAuthzEnabled,
  parsePersonalFolderOwner,
  personalFolderName,
} from './helpers.js';

export async function assertNoPersonalFolderSquat(
  folder: string,
  userId: string,
  container: string,
): Promise<void> {
  const ownerId = parsePersonalFolderOwner(folder);
  if (!ownerId || ownerId === userId) {
    return;
  }
  const personalRoot = personalFolderName(ownerId);
  const existing = await _StorageFolder
    .getInstance()
    .findOne({ name: personalRoot, container });
  if (isNil(existing)) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'You are not allowed to create this folder',
    );
  }
}

async function assertCanEditFolder(
  grpcSdk: ConduitGrpcSdk,
  subject: string,
  folder: _StorageFolder,
): Promise<void> {
  const allowed = await grpcSdk.authorization?.can({
    subject,
    actions: ['edit'],
    resource: `Folder:${folder._id}`,
  });
  if (!allowed || !allowed.allow) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      `You are not allowed to edit files in folder ${folder.name}`,
    );
  }
}

export async function assertFolderEditAccess(
  grpcSdk: ConduitGrpcSdk,
  container: string,
  folder: string,
  subject: string,
): Promise<void> {
  if (!isAuthzEnabled()) {
    return;
  }
  const folderDoc = await _StorageFolder
    .getInstance()
    .findOne({ name: folder, container });
  if (folderDoc) {
    await assertCanEditFolder(grpcSdk, subject, folderDoc);
    return;
  }

  const nestedPaths = getNestedPaths(folder);
  for (let i = nestedPaths.length - 2; i >= 0; i--) {
    const parent = await _StorageFolder
      .getInstance()
      .findOne({ name: nestedPaths[i], container });
    if (parent) {
      await assertCanEditFolder(grpcSdk, subject, parent);
      return;
    }
  }
}

export async function findOrCreateFolders(
  grpcSdk: ConduitGrpcSdk,
  storageProvider: IStorageProvider,
  folderPath: string,
  container: string,
  options?: {
    isPublic?: boolean;
    scope?: string;
    lastExistsHandler?: () => void;
  },
): Promise<_StorageFolder[]> {
  const containerDoc = await _StorageContainer.getInstance().findOne({ name: container });
  if (!containerDoc) {
    throw new GrpcError(status.NOT_FOUND, 'Container does not exist');
  }

  const createdFolders: _StorageFolder[] = [];
  const nestedPaths = getNestedPaths(folderPath);
  let previousFolder: _StorageFolder | null = null;

  for (let i = 0; i < nestedPaths.length; i++) {
    const currentPath = nestedPaths[i];
    const isLast = i === nestedPaths.length - 1;
    let folder = await _StorageFolder
      .getInstance()
      .findOne({ name: currentPath, container });

    if (isNil(folder)) {
      folder = await _StorageFolder.getInstance().create({
        name: currentPath,
        container,
        isPublic: options?.isPublic,
      });
      createdFolders.push(folder);
      const exists = await storageProvider.container(container).folderExists(currentPath);
      if (!exists) {
        await storageProvider.container(container).createFolder(currentPath);
      }
      await createFolderOwnerRelations(grpcSdk, folder, {
        isFirst: i === 0,
        containerId: containerDoc._id,
        parentFolderId: previousFolder?._id,
        scope: options?.scope,
      });
    } else if (isLast) {
      options?.lastExistsHandler?.();
    }
    previousFolder = folder;
  }

  return createdFolders;
}
