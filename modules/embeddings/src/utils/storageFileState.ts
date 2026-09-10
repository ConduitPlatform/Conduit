export const STORAGE_UPLOAD_PENDING = 'pending';

export function isFileBytesReady(file: { uploadStatus?: string }): boolean {
  return file.uploadStatus !== STORAGE_UPLOAD_PENDING;
}
