export interface IGetStorageContainers {
  skip: number;
  limit: number;
}

export interface IGetStorageFolders {
  skip: number;
  limit: number;
  container: string;
  parent?: string;
}

export interface IGetStorageFiles {
  skip: number;
  limit: number;
  container: string;
  folder?: string;
}

export interface ICreateStorageFile {
  name: string;
  data: string;
  folder?: string;
  container: string;
  mimeType: string;
  isPublic: boolean;
}

export interface ICreateStorageFolder {
  name: string;
  container: string;
  isPublic: boolean;
}

export interface ICreateStorageContainer {
  name: string;
  isPublic: boolean;
}

export interface IDeleteStorageFolder {
  id: string;
  name: string;
  container: string;
}

export interface IDeleteStorageContainer {
  id: string;
  name: string;
}
