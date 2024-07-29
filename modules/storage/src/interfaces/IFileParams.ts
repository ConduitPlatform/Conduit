export interface IFileParams {
  name?: string;
  alias?: string;
  container: string;
  folder: string;
  data?: string | Buffer;
  isPublic?: boolean;
  mimeType?: string;
  size?: number;
}
