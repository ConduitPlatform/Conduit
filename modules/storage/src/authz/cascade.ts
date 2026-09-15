import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { IStorageProvider } from '../interfaces/index.js';
import { _StorageContainer, _StorageFolder, File } from '../models/index.js';
import { folderPrefixRegex, isAuthzEnabled } from './helpers.js';
import {
  deleteAllRelationsSafe,
  deleteRelationsForResources,
  deleteRelationsForSubjects,
  forEachDocumentPage,
} from './relations.js';

export async function deleteFolderTree(
  grpcSdk: ConduitGrpcSdk,
  storageProvider: IStorageProvider,
  folder: _StorageFolder,
): Promise<void> {
  const prefix = folderPrefixRegex(folder.name);
  const folderQuery = { name: prefix, container: folder.container };
  const fileQuery = { folder: prefix, container: folder.container };

  if (isAuthzEnabled()) {
    await forEachDocumentPage(
      (skip, limit) =>
        _StorageFolder
          .getInstance()
          .findMany(folderQuery, { select: '_id', skip, limit }),
      async folders => {
        const ids = folders.map(doc => `Folder:${doc._id}`);
        await deleteRelationsForResources(grpcSdk, ids);
        await deleteRelationsForSubjects(grpcSdk, ids);
      },
    );
    await forEachDocumentPage(
      (skip, limit) =>
        File.getInstance().findMany(fileQuery, { select: '_id', skip, limit }),
      async files => {
        await deleteRelationsForResources(
          grpcSdk,
          files.map(doc => `File:${doc._id}`),
        );
      },
    );
  }

  await storageProvider.container(folder.container).deleteFolder(folder.name);
  await File.getInstance().deleteMany(fileQuery);
  await _StorageFolder.getInstance().deleteMany(folderQuery);
}

export async function deleteContainerTree(
  grpcSdk: ConduitGrpcSdk,
  storageProvider: IStorageProvider,
  container: _StorageContainer,
): Promise<void> {
  const query = { container: container.name };

  if (isAuthzEnabled()) {
    await forEachDocumentPage(
      (skip, limit) => File.getInstance().findMany(query, { select: '_id', skip, limit }),
      async files => {
        await deleteRelationsForResources(
          grpcSdk,
          files.map(doc => `File:${doc._id}`),
        );
      },
    );
    await forEachDocumentPage(
      (skip, limit) =>
        _StorageFolder.getInstance().findMany(query, { select: '_id', skip, limit }),
      async folders => {
        const ids = folders.map(doc => `Folder:${doc._id}`);
        await deleteRelationsForResources(grpcSdk, ids);
        await deleteRelationsForSubjects(grpcSdk, ids);
      },
    );
    await deleteAllRelationsSafe(grpcSdk, { subject: `Container:${container._id}` });
    await deleteAllRelationsSafe(grpcSdk, { resource: `Container:${container._id}` });
  }

  await storageProvider.deleteContainer(container.name);
  await File.getInstance().deleteMany(query);
  await _StorageFolder.getInstance().deleteMany(query);
  await _StorageContainer.getInstance().deleteOne({ _id: container._id });
}
