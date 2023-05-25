import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { StorageConfig } from '../interfaces';
import { _StorageFolder } from '../models';
import { FileHandlers } from '../handlers/file';
import { isNil } from 'lodash';
import path from 'path';

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

function getNestedPaths(
  inputPath: string,
  leadingSlash: boolean,
  trailingSlash: boolean,
): string[] {
  const paths: string[] = [];
  const normalizedPath = path.normalize(inputPath.trim()).replace(/^\/|\/$/g, '');
  const prefix = leadingSlash ? '/' : '';
  const suffix = trailingSlash ? '/' : '';
  const pathSegments = normalizedPath.split('/');
  let currentPath = '';
  for (const segment of pathSegments) {
    currentPath = path.join(currentPath, segment);
    paths.push(`${prefix}${currentPath}${suffix}`);
  }
  return paths;
}

export async function deepPathHandler(
  inputPath: string,
  leadingPath: boolean,
  trailingPath: boolean,
  handler: (inputPath: string, isLast: boolean) => Promise<void>,
): Promise<void> {
  const paths = getNestedPaths(inputPath, leadingPath, trailingPath);
  for (let i = 0; i < paths.length; i++) {
    await handler(paths[i], i === paths.length - 1);
  }
}

export async function deepCreateFolders(
  inputPath: string,
  container: string,
  isPublic: string,
  fileHandlers: FileHandlers,
  lastExistsHandler?: () => void,
): Promise<_StorageFolder[]> {
  const createdFolders: _StorageFolder[] = [];
  let folder: _StorageFolder | null = null;
  await deepPathHandler(inputPath, false, true, async (folderPath, isLast) => {
    folder = await _StorageFolder.getInstance().findOne({ name: folderPath, container });
    if (isNil(folder)) {
      folder = await _StorageFolder.getInstance().create({
        name: folderPath,
        container,
        isPublic,
      });
      createdFolders.push(folder);
      const exists = await fileHandlers.storage
        .container(container)
        .folderExists(folderPath);
      if (!exists) {
        await fileHandlers.storage.container(container).createFolder(folderPath);
      }
    } else if (isLast) {
      lastExistsHandler?.();
    }
  });
  return createdFolders;
}
