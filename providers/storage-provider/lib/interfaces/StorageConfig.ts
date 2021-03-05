export interface StorageConfig {
  /**
   * The path to use for storing local files
   * This is only used with the local storage provider
   */
  storagePath: string;
  google: {
    serviceAccountKeyPath: string;
    bucketName: string;
  };
  azure: {
    connectionString: string;
  };
}
