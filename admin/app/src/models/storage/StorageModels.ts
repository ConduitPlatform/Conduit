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

export interface IStorageFile {
  id: string;
  data: string;
  name?: string;
  container?: string;
  folder?: string;
  mimeType?: any;
}
