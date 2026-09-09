import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { _StorageContainer, _StorageFolder, File } from '../models/index.js';
import {
  ignoreMissingRelation,
  isAuthzEnabled,
  isDefaultContainer,
  isUsableSubject,
  RELATION_PAGE_SIZE,
} from './helpers.js';

export async function createOwnerRelation(
  grpcSdk: ConduitGrpcSdk,
  subject: string | undefined,
  resource: string,
): Promise<void> {
  if (!isAuthzEnabled() || !isUsableSubject(subject)) {
    return;
  }
  await grpcSdk.authorization?.createRelation({
    subject,
    relation: 'owner',
    resource,
  });
}

export async function deleteOwnerRelation(
  grpcSdk: ConduitGrpcSdk,
  subject: string | undefined,
  resource: string,
): Promise<void> {
  if (!isAuthzEnabled() || !isUsableSubject(subject)) {
    return;
  }
  await ignoreMissingRelation(() =>
    grpcSdk.authorization!.deleteRelation({
      subject,
      relation: 'owner',
      resource,
    }),
  );
}

export async function deleteAllRelationsSafe(
  grpcSdk: ConduitGrpcSdk,
  query: { subject?: string; resource?: string },
): Promise<void> {
  if (!isAuthzEnabled()) {
    return;
  }
  await ignoreMissingRelation(() => grpcSdk.authorization!.deleteAllRelations(query));
}

export async function resolveStructuralOwner(
  file: Pick<File, 'container' | 'folder'>,
): Promise<string> {
  if (file.folder === '/') {
    const containerDoc = await _StorageContainer
      .getInstance()
      .findOne({ name: file.container });
    if (!containerDoc) {
      throw new GrpcError(status.NOT_FOUND, 'Container does not exist');
    }
    return `Container:${containerDoc._id}`;
  }
  const folderDoc = await _StorageFolder
    .getInstance()
    .findOne({ name: file.folder, container: file.container });
  if (!folderDoc) {
    throw new GrpcError(status.NOT_FOUND, 'Folder does not exist');
  }
  return `Folder:${folderDoc._id}`;
}

export async function createFileRelations(
  grpcSdk: ConduitGrpcSdk,
  file: File,
  options?: { scope?: string; userId?: string },
): Promise<void> {
  if (!isAuthzEnabled()) {
    return;
  }
  const structuralOwner = await resolveStructuralOwner(file);
  await createOwnerRelation(grpcSdk, structuralOwner, `File:${file._id}`);
  if (isUsableSubject(options?.scope)) {
    await createOwnerRelation(grpcSdk, options.scope, `File:${file._id}`);
    return;
  }
  if (file.folder === '/' && options?.userId) {
    await createOwnerRelation(grpcSdk, `User:${options.userId}`, `File:${file._id}`);
  }
}

export async function updateFileRelations(
  grpcSdk: ConduitGrpcSdk,
  previous: Pick<File, '_id' | 'container' | 'folder'>,
  updated: Pick<File, '_id' | 'container' | 'folder'>,
  options?: { scope?: string },
): Promise<void> {
  if (!isAuthzEnabled()) {
    return;
  }
  const samePlace =
    previous.container === updated.container && previous.folder === updated.folder;
  if (!samePlace) {
    const oldOwner = await resolveStructuralOwner(previous);
    const newOwner = await resolveStructuralOwner(updated);
    if (oldOwner !== newOwner) {
      await deleteOwnerRelation(grpcSdk, oldOwner, `File:${updated._id}`);
      await createOwnerRelation(grpcSdk, newOwner, `File:${updated._id}`);
    }
  }
  if (isUsableSubject(options?.scope)) {
    await createOwnerRelation(grpcSdk, options.scope, `File:${updated._id}`);
  }
}

export async function createFolderOwnerRelations(
  grpcSdk: ConduitGrpcSdk,
  folder: _StorageFolder,
  options: {
    isFirst: boolean;
    containerId: string;
    parentFolderId?: string;
    scope?: string;
  },
): Promise<void> {
  if (!isAuthzEnabled()) {
    return;
  }
  const resource = `Folder:${folder._id}`;
  if (options.isFirst) {
    await createOwnerRelation(grpcSdk, `Container:${options.containerId}`, resource);
    await createOwnerRelation(grpcSdk, options.scope, resource);
    return;
  }
  if (!options.parentFolderId) {
    throw new GrpcError(status.INTERNAL, 'Parent folder is required for nested folders');
  }
  await createOwnerRelation(grpcSdk, `Folder:${options.parentFolderId}`, resource);
}

export async function createContainerOwnerRelation(
  grpcSdk: ConduitGrpcSdk,
  container: _StorageContainer,
  scope?: string,
): Promise<void> {
  if (
    !isAuthzEnabled() ||
    isDefaultContainer(container.name) ||
    !isUsableSubject(scope)
  ) {
    return;
  }
  await createOwnerRelation(grpcSdk, scope, `Container:${container._id}`);
}

export async function forEachDocumentPage<T extends { _id: string }>(
  fetchPage: (skip: number, limit: number) => Promise<T[]>,
  handler: (docs: T[]) => Promise<void>,
  pageSize: number = RELATION_PAGE_SIZE,
): Promise<void> {
  let skip = 0;
  while (true) {
    const page = await fetchPage(skip, pageSize);
    if (page.length === 0) {
      return;
    }
    await handler(page);
    if (page.length < pageSize) {
      return;
    }
    skip += pageSize;
  }
}

export async function deleteRelationsForResources(
  grpcSdk: ConduitGrpcSdk,
  resources: string[],
): Promise<void> {
  await Promise.all(
    resources.map(resource => deleteAllRelationsSafe(grpcSdk, { resource })),
  );
}

export async function deleteRelationsForSubjects(
  grpcSdk: ConduitGrpcSdk,
  subjects: string[],
): Promise<void> {
  await Promise.all(
    subjects.map(subject => deleteAllRelationsSafe(grpcSdk, { subject })),
  );
}
