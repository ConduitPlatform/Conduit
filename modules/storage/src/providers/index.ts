import { IStorageProvider, StorageConfig } from '../interfaces';
import { GoogleCloudStorage } from './google';
import { LocalStorage } from './local';
import { AzureStorage } from './azure';
import { AWSS3Storage } from './aws';
import { AliyunStorage } from './aliyun';

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
