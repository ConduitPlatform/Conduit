import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { IFileParams, IStorageProvider, StorageConfig } from '../interfaces/index.js';
import { isNil } from 'lodash-es';
import path from 'path';
import { _StorageContainer, _StorageFolder, File } from '../models/index.js';
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
      // shouldn't really provide an error
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

export async function getAwsAccountId(config: StorageConfig) {
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

export function getNestedPaths(inputPath: string): string[] {
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

export async function createFileRelations(
  grpcSdk: ConduitGrpcSdk,
  file: File,
  scope?: string,
) {
  if (file.folder === '/') {
    const containerDoc = await _StorageContainer
      .getInstance()
      .findOne({ name: file.container });
    await grpcSdk.authorization?.createRelation({
      subject: 'Container:' + containerDoc!._id,
      relation: 'owner',
      resource: `File:${file._id}`,
    });
    if (scope) {
      await grpcSdk.authorization?.createRelation({
        subject: scope,
        relation: 'owner',
        resource: `File:${file._id}`,
      });
    }
  } else {
    const folderDoc = await _StorageFolder
      .getInstance()
      .findOne({ name: file.folder, container: file.container });
    await grpcSdk.authorization?.createRelation({
      subject: 'Folder:' + folderDoc!._id,
      relation: 'owner',
      resource: `File:${file._id}`,
    });
  }
}

export async function updateFileRelations(
  grpcSdk: ConduitGrpcSdk,
  file: File,
  updatedFile: File,
  scope?: string,
) {
  if (updatedFile.container !== file.container) {
    const prevContainer = await _StorageContainer
      .getInstance()
      .findOne({ name: file.container });
    await grpcSdk.authorization?.deleteRelation({
      subject: 'Container:' + prevContainer!._id,
      relation: 'owner',
      resource: `File:${updatedFile._id}`,
    }); // TODO: add catch
  }
  if (updatedFile.folder === file.folder) {
    return;
  }

  if (updatedFile.folder === '/') {
    const newContainer = await _StorageContainer
      .getInstance()
      .findOne({ name: updatedFile.container });
    await grpcSdk.authorization?.createRelation({
      subject: 'Container:' + newContainer!._id,
      relation: 'owner',
      resource: `File:${updatedFile._id}`,
    });
    if (scope) {
      await grpcSdk.authorization?.createRelation({
        subject: scope!,
        relation: 'owner',
        resource: `File:${updatedFile._id}`,
      });
    }
  } else {
    const folderDoc = await _StorageFolder
      .getInstance()
      .findOne({ name: updatedFile.folder, container: updatedFile.container });
    await grpcSdk.authorization?.createRelation({
      subject: 'Folder:' + folderDoc!._id,
      relation: 'owner',
      resource: `File:${updatedFile._id}`,
    });
  }

  if (file.folder !== '/') {
    const prevFolder = await _StorageFolder
      .getInstance()
      .findOne({ name: file.folder, container: file.container });
    await grpcSdk.authorization?.deleteRelation({
      subject: 'Folder:' + prevFolder!._id,
      relation: 'owner',
      resource: `File:${updatedFile._id}`,
    });
  }
}

/* First folder in nested path will be owned by container
   First folder in nested path, if not pre-existing, will be owned by provided scope
   The other subfolders will be owned by their previous folder */
export async function findOrCreateFolders(
  grpcSdk: ConduitGrpcSdk,
  storageProvider: IStorageProvider,
  folderPath: string,
  container: string,
  isPublic?: boolean,
  scope?: string,
): Promise<_StorageFolder[]> {
  const authzEnabled = ConfigController.getInstance().config.authorization.enabled;
  const containerDoc = await _StorageContainer.getInstance().findOne({ name: container });
  if (!containerDoc) {
    throw new GrpcError(status.NOT_FOUND, 'Container does not exist');
  }
  const createdFolders: _StorageFolder[] = [];
  let folder: _StorageFolder | null = null;
  const nestedPaths = getNestedPaths(folderPath);

  for (let i = 0; i < nestedPaths.length; i++) {
    const folderPath = nestedPaths[i];
    const isFirst = i === 0;
    folder = await _StorageFolder.getInstance().findOne({ name: folderPath, container });

    let folderScope: string | undefined;
    if (authzEnabled && isFirst) {
      folderScope = scope;
    } else if (authzEnabled && !isFirst) {
      const prevFolder = (await _StorageFolder.getInstance().findOne({
        name: nestedPaths[i - 1],
        container,
      })) as _StorageFolder;
      folderScope = 'Folder:' + prevFolder._id;
    }

    if (!folder) {
      folder = await _StorageFolder.getInstance().create(
        {
          name: folderPath,
          container,
          isPublic,
        },
        undefined,
        folderScope,
      );
      createdFolders.push(folder);
      const exists = await storageProvider.container(container).folderExists(folderPath);
      if (!exists) {
        await storageProvider.container(container).createFolder(folderPath);
      }
    }

    if (authzEnabled && isFirst) {
      await grpcSdk.authorization?.createRelation({
        subject: 'Container:' + containerDoc._id,
        relation: 'owner',
        resource: `Folder:${folder!._id}`,
      });
    }
  }
  return createdFolders;
}

export async function storeNewFile(
  grpcSdk: ConduitGrpcSdk,
  storageProvider: IStorageProvider,
  params: IFileParams,
  scope?: string,
): Promise<File> {
  const { name, alias, data, container, folder, mimeType, isPublic } = params;
  const authzEnabled = ConfigController.getInstance().config.authorization.enabled;

  const buffer = Buffer.from(data as string, 'base64');
  const size = buffer.byteLength;
  const fileName = (folder === '/' ? '' : folder) + name;
  await storageProvider.container(container).store(fileName, buffer, isPublic);
  const publicUrl = isPublic
    ? await storageProvider.container(container).getPublicUrl(fileName)
    : null;

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
    url: publicUrl,
  });
  if (authzEnabled) {
    await createFileRelations(grpcSdk, file, scope);
  }
  return file;
}

export async function _createFileUploadUrl(
  grpcSdk: ConduitGrpcSdk,
  storageProvider: IStorageProvider,
  params: IFileParams,
  scope?: string,
): Promise<{ file: File; url: string }> {
  const { name, alias, container, folder, mimeType, isPublic, size } = params;
  const authzEnabled = ConfigController.getInstance().config.authorization.enabled;

  const fileName = (folder === '/' ? '' : folder) + name;
  await storageProvider
    .container(container)
    .store(fileName, Buffer.from('PENDING UPLOAD'), isPublic);
  const publicUrl = isPublic
    ? await storageProvider.container(container).getPublicUrl(fileName)
    : null;

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
    url: publicUrl,
  });
  if (authzEnabled) {
    await createFileRelations(grpcSdk, file, scope);
  }
  const url = (await storageProvider
    .container(container)
    .getUploadUrl(fileName)) as string;
  return {
    file,
    url,
  };
}

export async function _updateFile(
  grpcSdk: ConduitGrpcSdk,
  storageProvider: IStorageProvider,
  file: File,
  params: IFileParams,
  scope?: string,
): Promise<File> {
  const { name, alias, data, folder, container, mimeType } = params;
  const onlyDataUpdate =
    name === file.name && folder === file.folder && container === file.container;
  const authzEnabled = ConfigController.getInstance().config.authorization.enabled;

  await storageProvider
    .container(container)
    .store((folder === '/' ? '' : folder) + name, data, file.isPublic);
  if (!onlyDataUpdate) {
    await storageProvider
      .container(file.container)
      .delete((file.folder === '/' ? '' : file.folder) + file.name);
  }
  const url = file.isPublic
    ? await storageProvider
        .container(container)
        .getPublicUrl((folder === '/' ? '' : folder) + name)
    : null;
  const updatedFile = (await File.getInstance().findByIdAndUpdate(file._id, {
    name,
    alias,
    folder,
    container,
    url,
    mimeType,
  })) as File;
  if (authzEnabled) {
    await updateFileRelations(grpcSdk, file, updatedFile, scope);
  }
  updateFileMetrics(file.size, (data as Buffer).byteLength);
  return updatedFile;
}

export async function _updateFileUploadUrl(
  grpcSdk: ConduitGrpcSdk,
  storageProvider: IStorageProvider,
  file: File,
  params: IFileParams,
  scope?: string,
): Promise<{ file: File; url: string }> {
  const { name, alias, folder, container, mimeType, size } = params;
  const onlyDataUpdate =
    name === file.name && folder === file.folder && container === file.container;
  const authzEnabled = ConfigController.getInstance().config.authorization.enabled;
  let updatedFile;

  if (onlyDataUpdate) {
    updatedFile = await File.getInstance().findByIdAndUpdate(file._id, {
      mimeType,
      alias,
      ...{ size: size ?? file.size },
    });
  } else {
    await storageProvider
      .container(container)
      .store(
        (folder === '/' ? '' : folder) + name,
        Buffer.from('PENDING UPLOAD'),
        file.isPublic,
      );
    await storageProvider
      .container(file.container)
      .delete((file.folder === '/' ? '' : file.folder) + file.name);
    const url = file.isPublic
      ? await storageProvider
          .container(container)
          .getPublicUrl((folder === '/' ? '' : folder) + name)
      : null;

    updatedFile = await File.getInstance().findByIdAndUpdate(file._id, {
      name,
      alias,
      folder,
      container,
      url,
      mimeType,
      ...{ size: size ?? file.size },
    });
    if (authzEnabled) {
      await updateFileRelations(grpcSdk, file, updatedFile!, scope);
    }
  }
  if (!isNil(size)) updateFileMetrics(file.size, size!);
  const uploadUrl = (await storageProvider
    .container(container)
    .getUploadUrl((folder === '/' ? '' : folder) + name)) as string;
  return { file: updatedFile!, url: uploadUrl };
}

export function updateFileMetrics(currentSize: number, newSize: number) {
  const fileSizeDiff = Math.abs(currentSize - newSize);
  fileSizeDiff < 0
    ? ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', fileSizeDiff)
    : ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', fileSizeDiff);
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
