import {IStorageProvider} from "../../interfaces/IStorageProvider";
import {StorageConfig} from "../../interfaces/StorageConfig";
import {existsSync, writeFile, readFile} from "fs";
import {resolve} from "path";

export class LocalStorage implements IStorageProvider {

    _storagePath: string;

    constructor(options: StorageConfig) {
        this._storagePath = options && options.storagePath ? options.storagePath : ''
    }

    get(fileName: string): any {
        if (!existsSync(resolve(this._storagePath, fileName))) {
            return new Promise(function (res, reject) {
                reject("File does not exist");
            });
        }
        const self = this;
        return new Promise(function (res, reject) {
            readFile(resolve(self._storagePath, fileName), function (err) {
                if (err) reject(err);
                else res(true);
            });
        });

    }

    store(fileName: string, data: any): Promise<boolean | Error> {
        const self = this;
        return new Promise(function (res, reject) {
            writeFile(resolve(self._storagePath, fileName), data, function (err) {
                if (err) reject(err);
                else res(true);
            });
        });
    }

}
