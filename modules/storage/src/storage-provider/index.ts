import { IStorageProvider, StorageConfig } from './interfaces';
import { GoogleCloudStorage } from './providers/google';
import { LocalStorage } from './providers/local';
import { AzureStorage } from './providers/azure';
import { AWSS3Storage } from './providers/aws';
import { AliyunStorage } from './providers/aliyun';

export function createStorageProvider(
  provider: keyof StorageConfig,
  options: StorageConfig,
): IStorageProvider {
  switch (provider) {
    case 'google':
      return new GoogleCloudStorage(options);
    case 'azure':
      return new AzureStorage(options);
    case 'aws':
      return new AWSS3Storage(options);
    case 'aliyun':
      return new AliyunStorage(options);
    case 'local':
      return new LocalStorage(options);
    default:
      return new LocalStorage(options);
  }
}

export * from './interfaces';
