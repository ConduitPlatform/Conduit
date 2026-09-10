import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isFileBytesReady } from './storageFileState.js';

export const AUTOMATIC_STORAGE_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'application/pdf',
] as const;

export type AutomaticStorageMimeType = (typeof AUTOMATIC_STORAGE_MIME_TYPES)[number];

export interface StorageSourceSelectors {
  container: string;
  folderPrefix?: string;
  mimeTypes?: AutomaticStorageMimeType[];
}

export interface StorageFileMatchInput {
  container?: string;
  folder?: string;
  mimeType?: string;
  uploadStatus?: string;
}

export function parseStorageSelectors(raw: unknown): StorageSourceSelectors {
  const record =
    typeof raw === 'string'
      ? (JSON.parse(raw) as Record<string, unknown>)
      : ((raw ?? {}) as Record<string, unknown>);
  const container = typeof record.container === 'string' ? record.container.trim() : '';
  if (!container) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'conduit-storage sources require selectors.container',
    );
  }
  const folderPrefix =
    typeof record.folderPrefix === 'string' && record.folderPrefix.trim()
      ? record.folderPrefix.trim()
      : undefined;
  const mimeTypes = normalizeMimeAllowlist(record.mimeTypes);
  return {
    container,
    ...(folderPrefix ? { folderPrefix } : {}),
    ...(mimeTypes ? { mimeTypes } : {}),
  };
}

export function normalizeMimeAllowlist(
  value: unknown,
): AutomaticStorageMimeType[] | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  const allowed = new Set<string>(AUTOMATIC_STORAGE_MIME_TYPES);
  const mimeTypes = [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim().toLowerCase()),
    ),
  ];
  if (mimeTypes.some(item => !allowed.has(item))) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `mimeTypes must be a subset of ${AUTOMATIC_STORAGE_MIME_TYPES.join(', ')}`,
    );
  }
  return mimeTypes as AutomaticStorageMimeType[];
}

export function fileMatchesSelectors(
  file: StorageFileMatchInput,
  selectors: StorageSourceSelectors,
): boolean {
  if (!isFileBytesReady(file)) return false;
  if ((file.container ?? '') !== selectors.container) return false;
  if (selectors.folderPrefix) {
    const folder = file.folder ?? '';
    if (!folder.startsWith(selectors.folderPrefix)) return false;
  }
  const allowed = selectors.mimeTypes ?? [...AUTOMATIC_STORAGE_MIME_TYPES];
  const mime = (file.mimeType ?? '').toLowerCase();
  return allowed.includes(mime as AutomaticStorageMimeType);
}
