import { ObjectStat } from '../interfaces/index.js';

export const PENDING_UPLOAD_PLACEHOLDER = 'PENDING UPLOAD';
export const PENDING_UPLOAD_PLACEHOLDER_BYTES = Buffer.from(PENDING_UPLOAD_PLACEHOLDER);

export const FILE_UPLOAD_STATUS = {
  pending: 'pending',
  ready: 'ready',
} as const;

export type FileUploadStatus =
  (typeof FILE_UPLOAD_STATUS)[keyof typeof FILE_UPLOAD_STATUS];

export function normalizeEtag(etag?: string): string | undefined {
  if (!etag) return undefined;
  return etag.replaceAll('"', '').trim() || undefined;
}

export function isFileBytesReady(file: { uploadStatus?: string }): boolean {
  return file.uploadStatus !== FILE_UPLOAD_STATUS.pending;
}

export function buildContentVersion(stat: ObjectStat): string | undefined {
  if (!stat.exists) return undefined;
  const etag = normalizeEtag(stat.etag);
  if (etag) return etag;
  if (stat.checksum) return stat.checksum;
  if (stat.lastModified) {
    return `${stat.size ?? 0}:${stat.lastModified.getTime()}`;
  }
  if (typeof stat.size === 'number') {
    return `size:${stat.size}`;
  }
  return undefined;
}

export function applyObjectStatToFile(
  file: { mimeType?: string },
  stat: ObjectStat,
): {
  uploadStatus: typeof FILE_UPLOAD_STATUS.ready;
  size: number;
  etag?: string;
  checksum?: string;
  contentVersion?: string;
  mimeType?: string;
} {
  return {
    uploadStatus: FILE_UPLOAD_STATUS.ready,
    size: stat.size ?? 0,
    etag: normalizeEtag(stat.etag),
    checksum: stat.checksum,
    contentVersion: buildContentVersion(stat),
    mimeType: file.mimeType || stat.contentType,
  };
}

export async function objectIsPendingPlaceholder(
  file: { uploadStatus?: string; etag?: string },
  stat: ObjectStat,
  getBytes?: () => Promise<Buffer | Error>,
): Promise<boolean> {
  if (!stat.exists) return true;
  if ((stat.size ?? 0) <= 0) return true;
  if (file.uploadStatus !== FILE_UPLOAD_STATUS.pending) return false;

  const storedEtag = normalizeEtag(file.etag);
  const objectEtag = normalizeEtag(stat.etag);
  if (storedEtag && objectEtag && storedEtag === objectEtag) {
    return true;
  }

  if ((stat.size ?? 0) !== PENDING_UPLOAD_PLACEHOLDER_BYTES.length) {
    return false;
  }

  if (storedEtag && objectEtag && storedEtag !== objectEtag) {
    return false;
  }

  if (!getBytes) {
    return true;
  }

  const bytes = await getBytes();
  if (bytes instanceof Error) {
    return true;
  }
  return bytes.equals(PENDING_UPLOAD_PLACEHOLDER_BYTES);
}
