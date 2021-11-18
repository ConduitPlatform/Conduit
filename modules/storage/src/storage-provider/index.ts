import { IStorageProvider, StorageConfig } from './interfaces';
import { GoogleCloudStorage } from './providers/google';
import { LocalStorage } from './providers/local';
import { AzureStorage } from './providers/azure';

export function createStorageProvider(
  provider: string,
  options: StorageConfig
): IStorageProvider {
  if (provider === 'google') {
    return new GoogleCloudStorage(options);
  } else if (provider === 'azure') {
    return new AzureStorage(options);
  } else {
    return new LocalStorage();
  }
}

export * from './interfaces';
