import {LocalSettings} from "./interaces/LocalSettings";
import {RedisSettings} from "./interaces/RedisSettings";
import {MemcachedSettings} from "./interaces/MemcachedSettings";
import {RedisProvider} from "./providers/redis";
import {Localprovider} from "./providers/local";
import {MemcachedProvider} from "./providers/memcached";
import {StorageProvider} from "./interaces/StorageProvider";
import { Request, Response, NextFunction } from 'express';
import {isNil} from 'lodash';
import { ConduitSDK, IConduitInMemoryStore } from '@conduit/sdk';

class InMemoryStore extends IConduitInMemoryStore implements StorageProvider {

    private readonly _provider: StorageProvider;

    constructor(conduit: ConduitSDK, name: string, storageSettings: LocalSettings | RedisSettings | MemcachedSettings) {
        super(conduit);

        if (isNil(conduit)) {
            throw new Error('Conduit not initialized');
        }

        if (name === 'redis') {
            this._provider = new RedisProvider(storageSettings as RedisSettings);
        } else if (name === 'memcache') {
            this._provider = new MemcachedProvider(storageSettings as MemcachedSettings);
        } else {
            this._provider = new Localprovider(storageSettings as LocalSettings);
        }

        if ((conduit as any).config.get('admin.active')) {
            const admin = conduit.getAdmin();

            admin.registerRoute('POST', '/in-memory-store',
              (req: Request, res: Response, next: NextFunction) => this.adminStore(req, res, next).catch(next));

            admin.registerRoute('GET', '/in-memory-store/:key',
              (req: Request, res: Response, next: NextFunction) => this.adminGetByKey(req, res, next).catch(next));
        }

    }

    get(key: string): Promise<any> {
        return this._provider.get(key);
    }

    store(key: string, value: any): Promise<any> {
        return this._provider.store(key, value);
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

