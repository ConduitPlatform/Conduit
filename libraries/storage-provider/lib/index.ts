import {IStorageProvider} from "./interfaces/IStorageProvider";
import {GoogleCloudStorage} from "./providers/google";
import {StorageConfig} from "./interfaces/StorageConfig";
import {LocalStorage} from "./providers/local";


export class StorageProvider {

    _storageProvider?: IStorageProvider;
    _transportName?: string;

    constructor(provider: string, options: StorageConfig) {
        if (provider === 'google') {
            this._storageProvider = new GoogleCloudStorage(options);
        } else {
            this._storageProvider = new LocalStorage();
        }
    }

    get(): IStorageProvider {
        if (!this._storageProvider) throw new Error("Storage provider not initialized");
        return this._storageProvider;
    }


}



