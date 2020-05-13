import * as grpc from 'grpc';
import path from "path";
import { promisify } from "util";

let protoLoader = require('@grpc/proto-loader');

export default class Router {
    private readonly client: any;

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
        var router = protoDescriptor.conduit.core.Router;
        this.client = new router(url, grpc.credentials.createInsecure());
    }

    register(paths: any[], protoFile: string): Promise<any> {

        let grpcPathArray: any[] = [];
        paths.forEach(r => {
            let obj = {
                path: r.path,
                method: r.method,
                inputs: JSON.stringify(r.inputs),
                grpcFunction: r.protoName
            };
            grpcPathArray.push(obj);
        })
        let request = {
            routesList: grpcPathArray,
            protoFile: protoFile
        }
        return new Promise((resolve, reject) => {
        this.client.registerConduitRoute(request, (err: any, res: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve("OK");
                }
            })
        });

    }

}
