import {LocalSettings} from "./interaces/LocalSettings";
import {RedisSettings} from "./interaces/RedisSettings";
import {MemcachedSettings} from "./interaces/MemcachedSettings";
import {RedisProvider} from "./providers/redis";
import {Localprovider} from "./providers/local";
import {MemcachedProvider} from "./providers/memcached";
import {StorageProvider} from "./interaces/StorageProvider";
import { Request, Response, NextFunction } from 'express';
import {isNil, isPlainObject } from 'lodash';
import { ConduitSDK, IConduitInMemoryStore } from '@conduit/sdk';
import InMemoryStoreConfigSchema from './config/in-memory-store';
import inMemoryStoreConfigSchema from './config/in-memory-store';

class InMemoryStore extends IConduitInMemoryStore implements StorageProvider {

    private _provider: StorageProvider | null = null;

    constructor(private readonly conduit: ConduitSDK) {
        super(conduit);
    }

    validateConfig(configInput: any, configSchema: any = inMemoryStoreConfigSchema.inMemoryStore): boolean {
        if (isNil(configInput)) return false;

        return Object.keys(configInput).every(key => {
            if (configSchema.hasOwnProperty(key)) {
                if (isPlainObject(configInput[key])) {
                    return this.validateConfig(configInput[key], configSchema[key])
                } else if (configSchema[key].hasOwnProperty('format')) {
                    const format = configSchema[key].format.toLowerCase();
                    if (typeof configInput[key] === format) {
                        return true;
                    }
                }
            }
            return false;
        });
    }

    async initModule() {
        try {
            await this.enableModule();
            return true;
        } catch (e){
            console.log(e);
            return false;
        }
    }

    private async enableModule() {
        const name = (this.conduit as any).config.get('inMemoryStore.providerName');
        const storageSettings: LocalSettings | RedisSettings | MemcachedSettings = (this.conduit as any).config.get(`inMemoryStore.settings.${name}`);

        if (name === 'redis') {
            this._provider = new RedisProvider(storageSettings as RedisSettings);
            const isReady = await (this._provider as RedisProvider).isReady();
            if (!isReady) throw new Error('Redis failed to connect');
        } else if (name === 'memcache') {
            this._provider = new MemcachedProvider(storageSettings as MemcachedSettings);
        } else {
            this._provider = new Localprovider(storageSettings as LocalSettings);
        }

        const admin = this.conduit.getAdmin();

        admin.registerRoute('POST', '/in-memory-store',
          (req: Request, res: Response, next: NextFunction) => this.adminStore(req, res, next).catch(next));

        admin.registerRoute('GET', '/in-memory-store/:key',
          (req: Request, res: Response, next: NextFunction) => this.adminGetByKey(req, res, next).catch(next));
    }

    static get config() {
        return InMemoryStoreConfigSchema;
    }

    get(key: string): Promise<any> {
        return this._provider!.get(key);
    }

    store(key: string, value: any): Promise<any> {
        return this._provider!.store(key, value);
    }

    private async adminStore(req: Request, res: Response, next: NextFunction) {
        const {key, value} = req.body;
        if (isNil(key) || isNil(value)) {
            return res.status(401).json({error: 'Required fields are missing'});
        }

        const stored = await this.store(key, value);
        return res.json({stored});
    }

    private async adminGetByKey(req: Request, res: Response, next: NextFunction) {
        const key = req.params.key;
        if (isNil(key)) {
            return res.status(401).json({error: 'Required parameter "key" is missing'});
        }

        const stored = await this.get(key);
        return res.json({stored});
    }

}

export = InMemoryStore;

