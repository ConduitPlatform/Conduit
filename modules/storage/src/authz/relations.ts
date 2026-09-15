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

const MANAGED_RELATIONS = new Set(['owner', 'editor', 'reader']);

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

export async function hasManagedRelations(
  grpcSdk: ConduitGrpcSdk,
  resource: string,
): Promise<boolean> {
  if (!isAuthzEnabled()) {
    return false;
  }
  const result = await grpcSdk.authorization!.findRelation({
    resource,
    skip: 0,
    limit: 10,
  });
  const relations = result?.relations ?? [];
  if (relations.some(relation => MANAGED_RELATIONS.has(relation.relation))) {
    return true;
  }
  return (result?.count ?? 0) > 0 && relations.length === 0;
}

export async function healUnmanagedOwner(
  grpcSdk: ConduitGrpcSdk,
  subject: string | undefined,
  resource: string,
): Promise<void> {
  if (!isAuthzEnabled() || !isUsableSubject(subject)) {
    return;
  }
  if (await hasManagedRelations(grpcSdk, resource)) {
    return;
  }
  await createOwnerRelation(grpcSdk, subject, resource);
}

export async function healUnmanagedContainer(
  grpcSdk: ConduitGrpcSdk,
  container: Pick<_StorageContainer, '_id' | 'name'>,
  subject?: string,
): Promise<void> {
  if (isDefaultContainer(container.name)) {
    return;
  }
  await healUnmanagedOwner(grpcSdk, subject, `Container:${container._id}`);
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
  const actor = isUsableSubject(options?.scope)
    ? options.scope
    : options?.userId
      ? `User:${options.userId}`
      : undefined;
  await createOwnerRelation(grpcSdk, actor, `File:${file._id}`);
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
    let oldOwner: string | undefined;
    try {
      oldOwner = await resolveStructuralOwner(previous);
    } catch (error) {
      if (!(error instanceof GrpcError && error.code === status.NOT_FOUND)) {
        throw error;
      }
    }
    const newOwner = await resolveStructuralOwner(updated);
    if (oldOwner && oldOwner !== newOwner) {
      await deleteOwnerRelation(grpcSdk, oldOwner, `File:${updated._id}`);
    }
    if (!oldOwner || oldOwner !== newOwner) {
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

export async function healUnmanagedFolder(
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
  if (await hasManagedRelations(grpcSdk, `Folder:${folder._id}`)) {
    return;
  }
  await createFolderOwnerRelations(grpcSdk, folder, options);
  if (!options.isFirst && isUsableSubject(options.scope)) {
    await createOwnerRelation(grpcSdk, options.scope, `Folder:${folder._id}`);
  }
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
