import {StorageProvider} from "../interaces/StorageProvider";
import {LocalSettings} from "../interaces/LocalSettings";

export class Localprovider implements StorageProvider {

    _localStore: any;

    constructor(settings: LocalSettings) {
        this._localStore = {};
    }

    get(key: string): Promise<any> {
        return new Promise((resolve, reject) => {
            resolve(this._localStore[key]);
        })
    }

    store(key: string, value: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this._localStore[key] = value;
            resolve(this._localStore[key]);
        })
    }


}
