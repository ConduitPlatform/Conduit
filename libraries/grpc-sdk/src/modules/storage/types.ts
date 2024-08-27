export type GetFileParams =
  | {
      id: string;
      userId?: string;
      scope?: string;
    }[]
  | [id: string, userId?: string, scope?: string];

export enum GetFileParamEnum {
  id = 'id',
  userId = 'userId',
  scope = 'scope',
}

export type GetFileUrlParams = GetFileParams;

export const GetFileUrlParamEnum = GetFileParamEnum;

export type GetFileDataParams = GetFileParams;

export const GetFileDataParamEnum = GetFileParamEnum;

export type CreateFileParams =
  | {
      name: string | undefined;
      data: string;
      folder?: string;
      container?: string;
      mimeType?: string;
      isPublic?: boolean;
      userId?: string;
      scope?: string;
      alias?: string;
    }[]
  | [
      name: string | undefined,
      data: string,
      folder?: string,
      container?: string,
      mimeType?: string,
      isPublic?: boolean,
      userId?: string,
      scope?: string,
      alias?: string,
    ];

export enum CreateFileParamEnum {
  name = 'name',
  data = 'data',
  folder = 'folder',
  container = 'container',
  mimeType = 'mimeType',
  isPublic = 'isPublic',
  userId = 'userId',
  scope = 'scope',
  alias = 'alias',
}

export type UpdateFileParams =
  | {
      id: string;
      data: string;
      name?: string;
      folder?: string;
      container?: string;
      mimeType?: string;
      userId?: string;
      scope?: string;
      alias?: string;
    }[]
  | [
      id: string,
      data: string,
      name?: string,
      folder?: string,
      container?: string,
      mimeType?: string,
      userId?: string,
      scope?: string,
      alias?: string,
    ];

export enum UpdateFileParamEnum {
  id = 'id',
  data = 'data',
  name = 'name',
  folder = 'folder',
  container = 'container',
  mimeType = 'mimeType',
  userId = 'userId',
  scope = 'scope',
  alias = 'alias',
}

export type DeleteFileParams = GetFileParams;

export const DeleteFileParamEnum = GetFileParamEnum;

export type CreateFileByUrlParams =
  | {
      name: string | undefined;
      folder?: string;
      container?: string;
      mimeType?: string;
      size?: number;
      isPublic?: boolean;
      userId?: string;
      scope?: string;
      alias?: string;
    }[]
  | [
      name: string | undefined,
      folder?: string,
      container?: string,
      mimeType?: string,
      size?: number,
      isPublic?: boolean,
      userId?: string,
      scope?: string,
      alias?: string,
    ];

export enum CreateFileByUrlParamEnum {
  name = 'name',
  folder = 'folder',
  container = 'container',
  mimeType = 'mimeType',
  size = 'size',
  isPublic = 'isPublic',
  userId = 'userId',
  scope = 'scope',
  alias = 'alias',
}

export type UpdateFileByUrlParams =
  | {
      id: string;
      name?: string;
      folder?: string;
      container?: string;
      mimeType?: string;
      size?: number;
      userId?: string;
      scope?: string;
      alias?: string;
    }[]
  | [
      id: string,
      name?: string,
      folder?: string,
      container?: string,
      mimeType?: string,
      size?: number,
      userId?: string,
      scope?: string,
      alias?: string,
    ];

export enum UpdateFileByUrlParamEnum {
  id = 'id',
  name = 'name',
  folder = 'folder',
  container = 'container',
  mimeType = 'mimeType',
  size = 'size',
  userId = 'userId',
  scope = 'scope',
  alias = 'alias',
}
