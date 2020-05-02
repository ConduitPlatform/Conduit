import {LocalSettings} from './interaces/LocalSettings';
import {RedisSettings} from './interaces/RedisSettings';
import {MemcachedSettings} from './interaces/MemcachedSettings';
import {RedisProvider} from './providers/redis';
import {Localprovider} from './providers/local';
import {MemcachedProvider} from './providers/memcached';
import {StorageProvider} from './interaces/StorageProvider'
import {isNil} from 'lodash';
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import {grpcModule} from '@conduit/grpc-sdk';
import InMemoryStoreConfigSchema from './config/in-memory-store';
import {AdminHandler} from "./admin";

let protoLoader = require('@grpc/proto-loader');

export class InMemoryStore {

    private _provider: StorageProvider | null = null;
    private isRunning: boolean = false;
    private _admin: AdminHandler;
    private _url: string;

    constructor(private readonly conduit: ConduitGrpcSdk) {
        var packageDefinition = protoLoader.loadSync(
            './in-memory-store.proto',
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        var protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);

        var memoryStore = protoDescriptor.inmemorystore.InMemoryStore;
        var server = new grpcModule.Server();

        server.addService(memoryStore.service, {
            get: this.get,
            store: this.store
        });
        this._admin = new AdminHandler(server, this._provider);
        this._url = process.env.SERVICE_URL || '0.0.0.0:0';
        let result = server.bind(this._url, grpcModule.ServerCredentials.createInsecure());
        this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);
        console.log("bound on:", this._url);
        server.start();
        this.enableModule().catch(console.log)
    }

    get url(): string {
        return this._url;
    }

    get(call: any, callback: any) {
        this._provider!.get(call.request.key)
            .then(r => {
                callback(null, {data: r.toString()});
            })
            .catch(err => {
                callback(err);
            })

    }

    store(call: any, callback: any) {
        this._provider!.store(call.request.key, call.request.value)
            .then(r => {
                callback(null, {result: true});
            })
            .catch(err => {
                callback(err, null);
            });
    }

    async setConfig(newConfig: any) {
        // this was wrong either way
        // if (!ConduitSDK.validateConfig(newConfig, InMemoryStoreConfigSchema.inMemoryStore)) {
        //     throw new Error('Invalid configuration values');
        // }

        let errorMessage: string | null = null;
        const updateResult = await this.conduit.config.updateConfig(newConfig, 'inMemoryStore').catch((e: Error) => errorMessage = e.message);
        if (!isNil(errorMessage)) {
            throw new Error(errorMessage);
        }

        if ((this.conduit as any).config.get('inMemoryStore.active')) {
            await this.enableModule().catch((e: Error) => errorMessage = e.message);
        } else {
            throw new Error('Module is not active');
        }
        if (!isNil(errorMessage)) {
            throw new Error(errorMessage);
        }

        return updateResult;
    }

    private async enableModule() {
        if (!this.isRunning) {
            this.isRunning = true;
        }
        await this.initProvider();
        this._admin.updateProvider(this._provider);
    }

    static get config() {
        return InMemoryStoreConfigSchema;
    }


    private async initProvider() {
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
    }


}
