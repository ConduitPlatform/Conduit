export interface IStorageConfig {
  active: boolean;
  provider: string;
  storagePath: string;
  azure: {
    connectionString: string;
  };
  google: {
    serviceAccountKeyPath: string;
    bucketName: string;
  };
}
