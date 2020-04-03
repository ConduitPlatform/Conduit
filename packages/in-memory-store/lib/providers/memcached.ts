import {StorageProvider} from "../interaces/StorageProvider";
import {MemcachedSettings} from "../interaces/MemcachedSettings";
import {promisify} from "util";
import memjs from "memjs";

export class MemcachedProvider implements StorageProvider {

    _client: any;

    constructor(settings: MemcachedSettings) {
        this._client = memjs.Client.create(settings.server, settings.options);
        throw new Error("Not implemented yet!")
    }

    get(key: string): Promise<any> {
        return promisify(this._client.get(key)).bind(this._client);
    }

    store(key: string, value: any): Promise<any> {
        return promisify(this._client.set(key, value, {expires: 50000})).bind(this._client);
    }

}
