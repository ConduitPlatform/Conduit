import { IStorageProvider } from "./interfaces/IStorageProvider";
import { GoogleCloudStorage } from "./providers/google";
import { StorageConfig } from "./interfaces/StorageConfig";
import { LocalStorage } from "./providers/local";


export function createStorageProvider(provider: string, options: StorageConfig): IStorageProvider {
    if (provider === 'google') {
        return new GoogleCloudStorage(options);
    } else {
        return new LocalStorage();
    }
}

export * from './interfaces';
