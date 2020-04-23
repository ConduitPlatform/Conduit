import { LocalSettings } from './interaces/LocalSettings';
import { RedisSettings } from './interaces/RedisSettings';
import { MemcachedSettings } from './interaces/MemcachedSettings';
import { RedisProvider } from './providers/redis';
import { Localprovider } from './providers/local';
import { MemcachedProvider } from './providers/memcached';
import { StorageProvider } from './interaces/StorageProvider';
import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { ConduitSDK, IConduitInMemoryStore } from '@conduit/sdk';
import InMemoryStoreConfigSchema from './config/in-memory-store';

class InMemoryStore extends IConduitInMemoryStore implements StorageProvider {

    private _provider: StorageProvider | null = null;
    private isRunning: boolean = false;

    constructor(private readonly conduit: ConduitSDK) {
        super(conduit);
        if ((this.conduit as any).config.get('inMemoryStore.active')) {
            this.enableModule().catch(console.log);
        }
    }

    async initModule() {
        try {
            if ((this.conduit as any).config.get('inMemoryStore.active')) {
                if (this.isRunning) return {result: true};
                await this.enableModule();
                return {result: true};
            }
            throw new Error('Module is not active');
        } catch (e){
            console.log(e);
            return {result: false, error: e};
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

        this.isRunning = true;
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

