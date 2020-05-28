import * as grpc from 'grpc';
import path from "path";
import {EventEmitter} from "events";
import { isNil } from 'lodash';

let protoLoader = require('@grpc/proto-loader');


export default class Config {
    private readonly client: grpc.Client | any;

    constructor(url: string) {
        var packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, '../../proto/core.proto'),
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
                if (err || !res) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(JSON.parse(res.data));
                }
            })
        });
    }

    updateConfig(config: any, name: string): Promise<any> {
        let request = {
            config: JSON.stringify(config),
            moduleName: name
        };

        return new Promise((resolve, reject) => {
            this.client.updateConfig(request, (err: any, res: any) => {
                if (err || !res) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(JSON.parse(res.result));
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
                    resolve(res.modules);
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
        // TODO make newConfigSchema required when all modules provide their config schema
        let request: {[key: string]: any} = {
            moduleName: name.toString(),
            url: url.toString()
        };
        return new Promise((resolve, reject) => {
            this.client.registerModule(request, (err: any, res: any) => {
                if (err || !res) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.modules);
                }
            })
        });
    }

    watchModules() {
        let emitter = new EventEmitter();
        let call = this.client.watchModules({})
        call.on('data', function (data: any) {
            emitter.emit('module-registered', data.modules);
        });
        // call.on('end', function() {
        //     // The server has finished sending
        // });
        // call.on('error', function(e) {
        //     // An error has occurred and the stream has been closed.
        // });
        // call.on('status', function(status) {
        //     // process status
        // });

        return emitter;

    }

    registerModulesConfig(moduleName: string, newModulesConfigSchema: any) {
        let request = {moduleName, newModulesConfigSchema: JSON.stringify(newModulesConfigSchema)};
        return new Promise((resolve, reject) => {
            this.client.registerModulesConfig(request, (err: any, res: any) => {
                if (err || !res) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve({});
                }
            })
        });
    }

}
