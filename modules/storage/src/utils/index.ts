import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import {
  IFileParams,
  IStorageProvider,
  StorageConfig,
  UrlOptions,
} from '../interfaces/index.js';
import { isNil } from 'lodash-es';
import path from 'path';
import { File, _StorageContainer } from '../models/index.js';
import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { randomUUID } from 'node:crypto';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';

export async function streamToBuffer(readableStream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data: any) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

export async function getAwsAccountId(config: StorageConfig) {
  // when using non AWS S3 storage provider
  if (config.aws.endpoint) {
    return randomUUID();
  }
  const iamClient = new IAMClient({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
  const res = await iamClient.send(new GetUserCommand({}));
  const userId = res?.User?.UserId;
  if (isNil(userId)) {
    throw new Error('Unable to get AWS account ID');
  }
  return userId;
}

export function normalizeFolderPath(folderPath?: string) {
  if (!folderPath || folderPath.trim() === '' || folderPath.trim() === '/') return '/';
  return `${path.normalize(folderPath.trim()).replace(/^\/|\/$/g, '')}/`;
}

function getNestedPaths(inputPath: string): string[] {
  const paths: string[] = [];
  const strippedPath = !inputPath.trim()
    ? ''
    : path.normalize(inputPath.trim()).replace(/^\/|\/$/g, '');
  if (strippedPath !== '') {
    const pathSegments = strippedPath.split('/');
    let currentPath = '';
    for (const segment of pathSegments) {
      currentPath = path.join(currentPath, segment);
      paths.push(`${currentPath}/`);
    }
  }
  return paths;
}

export async function deepPathHandler(
  inputPath: string,
  handler: (inputPath: string, isLast: boolean) => Promise<void>,
): Promise<void> {
  const paths = getNestedPaths(inputPath);
  for (let i = 0; i < paths.length; i++) {
    await handler(paths[i], i === paths.length - 1);
  }
}

export function buildFileUri(fileId: string): string {
  return `/storage/getFileUrl/${fileId}`;
}

export function getStorageFileKey(folder: string, name?: string): string {
  return (folder === '/' ? '' : folder) + (name ?? '');
}

type FileReferences = {
  sourceUrl?: string;
  url?: string;
  uri?: string;
};

export async function resolveFileReferences(
  storageProvider: IStorageProvider,
  params: {
    container: string;
    folder: string;
    name?: string;
    isPublic?: boolean;
    fileId: string;
  },
): Promise<FileReferences> {
  if (!params.isPublic) {
    return {};
  }

  const containerDoc = await _StorageContainer
    .getInstance()
    .findOne({ name: params.container }, { readPreference: 'primary' });
  const containerIsPublic = containerDoc?.isPublic ?? false;
  const uri = buildFileUri(params.fileId);
  const fileName = getStorageFileKey(params.folder, params.name);

  if (!containerIsPublic) {
    return { sourceUrl: '', url: '', uri };
  }

  const publicUrlResult = await storageProvider
    .container(params.container)
    .getPublicUrl(fileName, true);
  if (publicUrlResult instanceof Error) {
    throw publicUrlResult;
  }

  return {
    sourceUrl: publicUrlResult,
    url: applyCdnHost(publicUrlResult, params.container),
    uri,
  };
}

export async function resolvePublicFileAccessUrl(
  storageProvider: IStorageProvider,
  file: File,
): Promise<string> {
  if (file.url) {
    return file.url;
  }

  const rawUrl = await storageProvider
    .container(file.container)
    .getSignedUrl(getStorageFileKey(file.folder, file.name), {
      download: false,
      fileName: file.alias ?? file.name,
    });
  if (rawUrl instanceof Error) {
    throw rawUrl;
  }
  return applyCdnHost(rawUrl, file.container) ?? rawUrl;
}

export async function storeNewFile(
  storageProvider: IStorageProvider,
  params: IFileParams,
): Promise<File> {
  const { name, alias, data, container, folder, mimeType, isPublic } = params;
  // Validate file privacy against container settings
  await validateFilePrivacy(container, isPublic);
  const buffer = Buffer.from(data as string, 'base64');
  const size = buffer.byteLength;
  const fileName = getStorageFileKey(folder, name);
  await storageProvider.container(container).store(fileName, buffer, isPublic);

  ConduitGrpcSdk.Metrics?.increment('files_total');
  ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', size);
  const file = await File.getInstance().create({
    name,
    alias,
    mimeType,
    folder: folder,
    container: container,
    size,
    isPublic,
  });
  const refs = await resolveFileReferences(storageProvider, {
    container,
    folder,
    name,
    isPublic,
    fileId: file._id,
  });
  return refs.uri || refs.url || refs.sourceUrl
    ? ((await File.getInstance().findByIdAndUpdate(file._id, refs)) as File)
    : file;
}

export async function _createFileUploadUrl(
  storageProvider: IStorageProvider,
  params: IFileParams,
): Promise<{ file: File; url: string }> {
  const { name, alias, container, folder, mimeType, isPublic, size } = params;
  // Validate file privacy against container settings
  await validateFilePrivacy(container, isPublic);
  const fileName = getStorageFileKey(folder, name);
  await storageProvider
    .container(container)
    .store(fileName, Buffer.from('PENDING UPLOAD'), isPublic);

  ConduitGrpcSdk.Metrics?.increment('files_total');
  ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', size);
  const file = await File.getInstance().create({
    name,
    alias,
    mimeType,
    size,
    folder: folder,
    container: container,
    isPublic,
  });
  const refs = await resolveFileReferences(storageProvider, {
    container,
    folder,
    name,
    isPublic,
    fileId: file._id,
  });
  const storedFile =
    refs.uri || refs.url || refs.sourceUrl
      ? ((await File.getInstance().findByIdAndUpdate(file._id, refs)) as File)
      : file;
  const uploadUrl = (await storageProvider
    .container(container)
    .getUploadUrl(fileName)) as string;
  return {
    file: storedFile,
    url: uploadUrl,
  };
}

export async function _updateFile(
  storageProvider: IStorageProvider,
  file: File,
  params: IFileParams,
): Promise<File> {
  const { name, alias, data, folder, container, mimeType } = params;
  await validateFilePrivacy(container, file.isPublic);
  const onlyDataUpdate =
    name === file.name && folder === file.folder && container === file.container;
  await storageProvider
    .container(container)
    .store(getStorageFileKey(folder, name), data, file.isPublic);
  if (!onlyDataUpdate) {
    await storageProvider
      .container(file.container)
      .delete(getStorageFileKey(file.folder, file.name));
  }

  const refs = await resolveFileReferences(storageProvider, {
    container,
    folder,
    name,
    isPublic: file.isPublic,
    fileId: file._id,
  });

  const updatedFile = (await File.getInstance().findByIdAndUpdate(file._id, {
    name,
    alias,
    folder,
    container,
    sourceUrl: refs.sourceUrl,
    url: refs.url,
    uri: refs.uri,
    mimeType,
  })) as File;
  updateFileMetrics(file.size, (data as Buffer).byteLength);
  return updatedFile;
}

export async function _updateFileUploadUrl(
  storageProvider: IStorageProvider,
  file: File,
  params: IFileParams,
): Promise<{ file: File; url: string }> {
  const { name, alias, folder, container, mimeType, size } = params;
  await validateFilePrivacy(container, file.isPublic);
  const refs = await resolveFileReferences(storageProvider, {
    container,
    folder,
    name,
    isPublic: file.isPublic,
    fileId: file._id,
  });
  let updatedFile;
  const onlyDataUpdate =
    name === file.name && folder === file.folder && container === file.container;
  if (onlyDataUpdate) {
    updatedFile = await File.getInstance().findByIdAndUpdate(file._id, {
      mimeType,
      alias,
      sourceUrl: refs.sourceUrl,
      url: refs.url,
      uri: refs.uri,
      ...{ size: size ?? file.size },
    });
  } else {
    await storageProvider
      .container(container)
      .store(
        getStorageFileKey(folder, name),
        Buffer.from('PENDING UPLOAD'),
        file.isPublic,
      );
    await storageProvider
      .container(file.container)
      .delete(getStorageFileKey(file.folder, file.name));

    updatedFile = await File.getInstance().findByIdAndUpdate(file._id, {
      name,
      alias,
      folder,
      container,
      sourceUrl: refs.sourceUrl,
      url: refs.url,
      uri: refs.uri,
      mimeType,
      ...{ size: size ?? file.size },
    });
  }
  if (!isNil(size)) updateFileMetrics(file.size, size!);
  const uploadUrl = (await storageProvider
    .container(container)
    .getUploadUrl(getStorageFileKey(folder, name))) as string;
  return { file: updatedFile!, url: uploadUrl };
}

export function updateFileMetrics(currentSize: number, newSize: number) {
  const fileSizeDiff = Math.abs(currentSize - newSize);
  if (newSize > currentSize) {
    ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', fileSizeDiff);
  } else {
    ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', fileSizeDiff);
  }
}

export async function validateName(
  name: string | undefined,
  folder: string,
  container: string,
) {
  if (!name) {
    return randomUUID();
  }
  const config = ConfigController.getInstance().config;
  const extension = path.extname(name);
  const escapedExtension = extension.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const baseName = path.basename(name, extension);
  const escapedBaseName = baseName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regexPattern = `^${escapedBaseName} \\(\\d+\\)${escapedExtension}$`;

  const count = await File.getInstance().countDocuments({
    $and: [
      { $or: [{ name }, { name: { $regex: regexPattern } }] },
      { folder: folder },
      { container: container },
    ],
  });
  if (count === 0) {
    return name;
  } else if (!config.suffixOnNameConflict) {
    throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
  } else {
    if (extension !== '') {
      return `${baseName} (${count})${extension}`;
    }
    return `${name} (${count})`;
  }
}

export const constructDispositionHeader = (
  fileName: string,
  options?: UrlOptions,
): string | undefined => {
  if (!options || (!options.download && !options.fileName)) {
    return undefined;
  }
  const disposition = options.download ? 'attachment' : 'inline';
  const _fileName = `; filename="${options.fileName ?? fileName}"`;
  const _fileNameUtf8 = `; filename*=UTF-8''${encodeURIComponent(
    options.fileName ?? fileName,
  )}`;
  return `${disposition}${_fileName}${_fileNameUtf8}`;
};

/**
 * Replaces the storage host in a URL with the configured CDN host for the container.
 * @param url The original URL from the storage provider
 * @param container The container name
 * @returns The URL with CDN host if configured, otherwise the original URL
 */
export function applyCdnHost(
  url: string | null | undefined,
  container: string,
): string | undefined {
  if (!url) return undefined;
  const config = ConfigController.getInstance().config;
  const cdnHost = config.cdnConfiguration?.[container] as string | undefined;
  if (!cdnHost) return url;

  try {
    const urlObj = new URL(url);
    return url.replace(urlObj.host, cdnHost);
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}

export async function validateFilePrivacy(
  containerName: string,
  isFilePublic?: boolean,
): Promise<void> {
  const container = await _StorageContainer
    .getInstance()
    .findOne({ name: containerName }, { readPreference: 'primary' });
  if (container?.isPublic && !isFilePublic) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Files in public containers must be public',
    );
  }
}
