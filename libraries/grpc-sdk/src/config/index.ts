import * as grpc from 'grpc';
import path from "path";

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
        return new Promise((resolve, reject) => {
            this.client.get(request, (err: any, res: any) => {
                if (err || !res || !res.data) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.data);
                }
            })
        });
    }

    updateConfig(config: any, name: string): Promise<any> {
        let request = {
            config: config,
            moduleName: name
        };
        return new Promise((resolve, reject) => {
            this.client.updateConfig(request, (err: any, res: any) => {
                if (err || !res || !res.result) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.result);
                }
            })
        });
    }

    moduleExists(name: string): Promise<any> {
        let request = {
            moduleName: name
        };
        return new Promise((resolve, reject) => {
            this.client.moduleExists(request, (err: any, res: any) => {
                if (err || !res) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.url);
                }
            })
        });
    }

    moduleList(): Promise<any[]> {
        let request = {};
        return new Promise((resolve, reject) => {
            this.client.moduleList(request, (err: any, res: any) => {
                if (err || !res) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.modules);
                }
            })
        });
    }

    registerModule(name: string, url: string): Promise<any> {
        let request = {
            moduleName: name.toString(),
            url: url.toString()
        };
        return new Promise((resolve, reject) => {
            this.client.registerModule(request, (err: any, res: any) => {
                if (err || !res || !res.result) {
                    reject(err || 'Module was not registered');
                } else {
                    resolve(res.result);
                }
            })
        });
    }

}
