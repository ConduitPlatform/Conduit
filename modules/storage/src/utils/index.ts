import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { StorageConfig } from '../interfaces/index.js';
import { isNil } from 'lodash-es';
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
