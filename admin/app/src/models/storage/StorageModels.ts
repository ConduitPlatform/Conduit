export interface IStorageConfig {
  active: boolean;
  provider: string;
  storagePath: string;
  allowContainerCreation: boolean;
  defaultContainer: string;
  azure: {
    connectionString: string;
  };
  google: {
    serviceAccountKeyPath: string;
    bucketName: string;
  };
}

export interface IStorageFileData {
  container: string;
  createdAt: string;
  updatedAt: string;
  folder?: string;
  isFile: boolean;
  isPublic: boolean;
  mimeType: string;
  name: string;
  url?: string;
  _id: string;
  __v: number;
}

export interface IStorageFolderData {
  container: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  name: string;
  _id: string;
  __v: number;
}

export interface IStorageContainerData {
  createdAt: string;
  isPublic: boolean;
  name: string;
  updatedAt: string;
  __v: number;
  _id: string;
}

export interface IStorageFile {
  name: string;
  data: string;
  folder?: string;
  container: string;
  isPublic: boolean;
  mimeType: string;
}

export interface IContainer {
  createdAt: string;
  isPublic: boolean;
  name: string;
  updatedAt: string;
  __v: number;
  _id: string;
}

export enum CreateFormSelected {
  folder = 'folder',
  container = 'container',
}

export interface ICreateForm {
  container: {
    name: string;
    isPublic: boolean;
  };
  folder: {
    name: string;
    container: string;
    isPublic: boolean;
  };
}
