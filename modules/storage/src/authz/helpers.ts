import { GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { normalizeFolderPath } from '../utils/index.js';

export const RELATION_PAGE_SIZE = 100;

export function isAuthzEnabled(): boolean {
  return ConfigController.getInstance().config.authorization?.enabled === true;
}

export function defaultContainerName(): string {
  return ConfigController.getInstance().config.defaultContainer as string;
}

export function isDefaultContainer(name: string): boolean {
  return name === defaultContainerName();
}

export function personalFolderName(userId: string): string {
  return normalizeFolderPath(`cnd_${userId}`);
}

export function resolveClientFolder(
  folderParam: string | undefined,
  userId: string,
): string {
  if (folderParam == null || folderParam.trim() === '') {
    return personalFolderName(userId);
  }
  return normalizeFolderPath(folderParam);
}

export function parsePersonalFolderOwner(folder: string): string | undefined {
  const match = /^cnd_([^/]+)\//.exec(folder);
  return match?.[1];
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function folderPrefixRegex(folderName: string): { $regex: string } {
  return { $regex: `^${escapeRegex(folderName)}` };
}

export function isUsableSubject(subject?: string | null): subject is string {
  return typeof subject === 'string' && subject.length > 0;
}

export function resolveFileId(request: Indexable): string | undefined {
  const id = request.params?.id ?? request.urlParams?.id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export function resolveScope(request: Indexable): string | undefined {
  const scope = request.queryParams?.scope ?? request.params?.scope;
  return typeof scope === 'string' && scope.length > 0 ? scope : undefined;
}

export function resolveUserId(request: Indexable): string | undefined {
  const id = request.context?.user?._id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export function actorSubject(request: Indexable): string | undefined {
  const scope = resolveScope(request);
  if (isUsableSubject(scope)) return scope;
  const userId = resolveUserId(request);
  return userId ? `User:${userId}` : undefined;
}

export function rethrowGrpcOrInternal(
  error: unknown,
  fallback = 'Something went wrong',
): never {
  if (error instanceof GrpcError) {
    throw error;
  }
  throw new GrpcError(status.INTERNAL, (error as Error).message ?? fallback);
}

export function isMissingRelationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('No relations found') || message.includes('Relation does not exist')
  );
}

export async function ignoreMissingRelation<T>(
  work: () => Promise<T>,
): Promise<T | void> {
  try {
    return await work();
  } catch (error) {
    if (isMissingRelationError(error)) {
      return;
    }
    throw error;
  }
}
