import * as grpc from 'grpc';
import {ConfigClient} from '@conduit/protos/dist/src/config_grpc_pb';
import {GetRequest, UpdateRequest} from "@conduit/protos/dist/src/config_pb";

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
                    reject(err);
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
                    reject(err);
                } else {
                    resolve(res.getResult());
                }
            })
        });
    }

}
