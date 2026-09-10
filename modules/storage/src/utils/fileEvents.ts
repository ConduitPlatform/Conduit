import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { File } from '../models/index.js';
import { FILE_UPLOAD_STATUS } from './fileUploadState.js';

export const FILE_LIFECYCLE_EVENTS = {
  ready: 'storage:ready:File',
  update: 'storage:update:File',
  delete: 'storage:delete:File',
  deleteMany: 'storage:deleteMany:File',
  deleteFolder: 'storage:delete:Folder',
  deleteContainer: 'storage:delete:Container',
} as const;

export const MAX_FILE_DELETE_EVENT_IDS = 500;

export type FileLifecyclePayload = {
  id: string;
  name?: string;
  container?: string;
  folder?: string;
  mimeType?: string;
  size?: number;
  isPublic?: boolean;
  uploadStatus?: string;
  contentVersion?: string;
};

export function toFileLifecyclePayload(file: File): FileLifecyclePayload {
  return {
    id: file._id,
    name: file.name,
    container: file.container,
    folder: file.folder,
    mimeType: file.mimeType,
    size: file.size,
    isPublic: file.isPublic,
    uploadStatus: file.uploadStatus ?? FILE_UPLOAD_STATUS.ready,
    contentVersion: file.contentVersion,
  };
}

export function emitFileLifecycleEvent(
  grpcSdk: ConduitGrpcSdk | undefined,
  channel: string,
  payload: unknown,
): void {
  grpcSdk?.bus?.publish(channel, JSON.stringify(payload));
}

export function emitFileReady(grpcSdk: ConduitGrpcSdk | undefined, file: File): void {
  emitFileLifecycleEvent(
    grpcSdk,
    FILE_LIFECYCLE_EVENTS.ready,
    toFileLifecyclePayload(file),
  );
}

export function emitFileUpdate(grpcSdk: ConduitGrpcSdk | undefined, file: File): void {
  emitFileLifecycleEvent(
    grpcSdk,
    FILE_LIFECYCLE_EVENTS.update,
    toFileLifecyclePayload(file),
  );
}

export function emitFileDelete(grpcSdk: ConduitGrpcSdk | undefined, file: File): void {
  emitFileLifecycleEvent(
    grpcSdk,
    FILE_LIFECYCLE_EVENTS.delete,
    toFileLifecyclePayload(file),
  );
}

export function emitFileDeleteMany(
  grpcSdk: ConduitGrpcSdk | undefined,
  ids: string[],
  context: { container?: string; folder?: string },
): void {
  for (let offset = 0; offset < ids.length; offset += MAX_FILE_DELETE_EVENT_IDS) {
    emitFileLifecycleEvent(grpcSdk, FILE_LIFECYCLE_EVENTS.deleteMany, {
      ids: ids.slice(offset, offset + MAX_FILE_DELETE_EVENT_IDS),
      container: context.container,
      folder: context.folder,
    });
  }
}

export function emitFolderDeleted(
  grpcSdk: ConduitGrpcSdk | undefined,
  folder: { id: string; name: string; container: string },
): void {
  emitFileLifecycleEvent(grpcSdk, FILE_LIFECYCLE_EVENTS.deleteFolder, {
    id: folder.id,
    name: folder.name,
    container: folder.container,
  });
}

export function emitContainerDeleted(
  grpcSdk: ConduitGrpcSdk | undefined,
  container: { id: string; name: string },
): void {
  emitFileLifecycleEvent(grpcSdk, FILE_LIFECYCLE_EVENTS.deleteContainer, {
    id: container.id,
    name: container.name,
    container: container.name,
  });
}
