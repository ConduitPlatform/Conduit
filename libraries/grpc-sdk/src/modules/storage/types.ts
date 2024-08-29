export type CreateFileOptions = {
  folder?: string;
  container?: string;
  mimeType?: string;
  isPublic?: boolean;
  userId?: string;
  scope?: string;
  alias?: string;
};

export type UpdateFileOptions = {
  name?: string;
  folder?: string;
  container?: string;
  mimeType?: string;
  userId?: string;
  scope?: string;
  alias?: string;
};

export type CreateFileByURLOptions = { size?: number } & CreateFileOptions;

export type UpdateFileByURLOptions = { size?: number } & UpdateFileOptions;
