import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { File } from '../models/index.js';
import { isFileBytesReady } from './fileUploadState.js';

export interface BoundedFileBytes {
  data: Buffer;
  size: number;
  mimeType?: string;
  name?: string;
  contentVersion?: string;
  container?: string;
  folder?: string;
}

export function objectPathForFile(file: { folder?: string; name?: string }): string {
  if (!file.folder || file.folder === '/') return file.name ?? '';
  return `${file.folder}${file.name ?? ''}`;
}

export async function readBoundedFileBytes(args: {
  file: Pick<
    File,
    'name' | 'folder' | 'container' | 'size' | 'uploadStatus' | 'contentVersion'
  > & {
    mimeType?: string;
  };
  maxBytes: number;
  readObject: () => Promise<Buffer | Error>;
}): Promise<BoundedFileBytes> {
  if (!isFileBytesReady(args.file)) {
    throw new GrpcError(status.FAILED_PRECONDITION, 'File upload is not complete');
  }
  if (!Number.isInteger(args.maxBytes) || args.maxBytes < 1) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'maxBytes must be a positive integer');
  }
  if (typeof args.file.size === 'number' && args.file.size > args.maxBytes) {
    throw new GrpcError(
      status.RESOURCE_EXHAUSTED,
      `File exceeds the ${args.maxBytes} byte extraction limit`,
    );
  }
  const result = await args.readObject();
  if (result instanceof Error) {
    throw new GrpcError(status.INTERNAL, result.message);
  }
  if (result.length > args.maxBytes) {
    throw new GrpcError(
      status.RESOURCE_EXHAUSTED,
      `File exceeds the ${args.maxBytes} byte extraction limit`,
    );
  }
  return {
    data: result,
    size: result.length,
    mimeType: args.file.mimeType,
    name: args.file.name,
    contentVersion: args.file.contentVersion,
    container: args.file.container,
    folder: args.file.folder,
  };
}
