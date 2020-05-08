import * as grpc from 'grpc';
import path from "path";
import { promisify } from 'util';

let protoLoader = require('@grpc/proto-loader');


export default class Config {
    private readonly client: grpc.Client | any;

    constructor(url: string) {
        var packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, '../proto/core.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        // @ts-ignore
        var config = protoDescriptor.conduit.core.Config;
        this.client = new config(url, grpc.credentials.createInsecure());
    }

    get(name: string): Promise<any> {
        let request = {
            key: name
        };
        return promisify(this.client.get(request)).bind(this.client);
    }

    updateConfig(config: any, name: string): Promise<any> {
        let request = {
            config: config,
            moduleName: name
        };

        return promisify(this.client.updateConfig(request)).bind(this.client);
    }

    moduleExists(name: string): Promise<any> {
        let request = {
            moduleName: name
        };
        return promisify(this.client.moduleExists(request)).bind(this.client);
    }

    moduleList(): Promise<any[]> {
        let request = {};
        return promisify(this.client.moduleList(request)).bind(this.client);
    }

    registerModule(name: string, url: string): Promise<any> {
        let request = {
            moduleName: name.toString(),
            url: url.toString()
        };
        return promisify(this.client.registerModule(request)).bind(this.client);

    }

}
