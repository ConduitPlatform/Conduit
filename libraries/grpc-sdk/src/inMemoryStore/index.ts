import * as grpc from 'grpc';
import path from 'path';
import { promisify } from 'util';

let protoLoader = require('@grpc/proto-loader');


export default class InMemoryStore {
    private readonly client: any;

    constructor(url: string) {
        var packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, '../proto/in-memory-store.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        // @ts-ignore
        var store = protoDescriptor.inmemorystore.InMemoryStore;
        this.client = new store(url, grpc.credentials.createInsecure());
    }

    get(key: string): Promise<any> {
            return promisify(this.client.get({
                key: key
            })).bind(this.client);
    }

    store(key: string, data: any): Promise<boolean> {
        // @ts-ignore
        return promisify(this.client.store({
                key: key,
                data: data.toString()
            })).bind(this.client);
    }

}
