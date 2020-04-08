import {LocalSettings} from "./interaces/LocalSettings";
import {RedisSettings} from "./interaces/RedisSettings";
import {MemcachedSettings} from "./interaces/MemcachedSettings";
import {RedisProvider} from "./providers/redis";
import {Localprovider} from "./providers/local";
import {MemcachedProvider} from "./providers/memcached";
import {StorageProvider} from "./interaces/StorageProvider";
import { Application } from 'express';

class InMemoryStore implements StorageProvider {

    private static _instance: InMemoryStore;
    _provider: StorageProvider;

    private constructor(app: Application, name: string, storageSettings: LocalSettings | RedisSettings | MemcachedSettings) {
        if (name === 'redis') {
            this._provider = new RedisProvider(storageSettings as RedisSettings);
        } else if (name === 'memcache') {
            this._provider = new MemcachedProvider(storageSettings as MemcachedSettings);
        } else {
            this._provider = new Localprovider(storageSettings as LocalSettings);
        }
    }

    public static getInstance(app?: Application, name?: string, storageSettings?: LocalSettings | RedisSettings | MemcachedSettings) {
        if (!this._instance && name && storageSettings && app) {
            this._instance = new InMemoryStore(app, name, storageSettings);
        } else if (this._instance) {
            return this._instance
        } else {
            throw new Error("No settings provided to initialize");
        }
    }

    get(key: string): Promise<any> {
        return this._provider.get(key);
    }

    store(key: string, value: any): Promise<any> {
        return this._provider.store(key, value);
    }
}

export = InMemoryStore;

