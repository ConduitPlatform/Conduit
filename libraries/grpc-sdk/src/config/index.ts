import * as grpc from 'grpc';
import {ConfigClient} from "@conduit/protos/dist/src/core_grpc_pb";
import {GetRequest, ModuleExistsRequest, RegisterModuleRequest, UpdateRequest} from "@conduit/protos/dist/src/core_pb";

export default class Config {
    private readonly client: ConfigClient;

    constructor(url: string) {
        this.client = new ConfigClient(url, grpc.credentials.createInsecure());
    }

    get(name: string): Promise<any> {
        let request = new GetRequest();
        request.setKey(name);
        return new Promise((resolve, reject) => {
            this.client.get(request, (err, res) => {
                if (err || !res || !res.hasData()) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.getData());
                }
            })
        });
    }

    updateConfig(config: any, name: string): Promise<any> {
        let request = new UpdateRequest();
        request.setConfig(config);
        request.setModulename(name);
        return new Promise((resolve, reject) => {
            this.client.updateConfig(request, (err, res) => {
                if (err || !res || !res.hasResult()) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.getResult());
                }
            })
        });
    }

    moduleExists(name: string): Promise<any> {
        let request = new ModuleExistsRequest();
        request.setModulename(name);
        return new Promise((resolve, reject) => {
            this.client.moduleExists(request, (err, res) => {
                if (err || !res) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.getUrl());
                }
            })
        });
    }

    registerModule(name: string, url: string): Promise<any> {
        let request = new RegisterModuleRequest();
        request.setModulename(name);
        request.setUrl(url);
        return new Promise((resolve, reject) => {
            this.client.registerModule(request, (err, res) => {
                if (err || !res || !res.getResult()) {
                    reject(err || 'Module was not registered');
                } else {
                    resolve(res.getResult());
                }
            })
        });
    }

}
