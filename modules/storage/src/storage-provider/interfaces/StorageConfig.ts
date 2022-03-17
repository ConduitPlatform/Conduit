export interface StorageConfig {
  /**
   * The path to use for storing local files
   * This is only used with the local storage provider
   */
  google: {
    serviceAccountKeyPath: string;
  };
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    accountId: string;
  };
  azure: {
    connectionString: string;
  };
  local: {
    storagePath: string;
  };
}
