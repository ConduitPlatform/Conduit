import * as grpc from 'grpc';
import path from 'path';

let protoLoader = require('@grpc/proto-loader');


export default class Admin {
    private readonly client: any;

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
        var admin = protoDescriptor.conduit.core.Admin;
        this.client = new admin(url, grpc.credentials.createInsecure());
    }

    register(paths: any[], protoFile: string, serverUrl:string): Promise<any> {

        let grpcPathArray: any[] = [];
        paths.forEach(r => {
            let obj = {
                path: r.path,
                method: r.method,
                grpcFunction: r.protoName
            };
            grpcPathArray.push(obj);
        })
        let request = {
            routes: grpcPathArray,
            protoFile: protoFile,
            adminUrl: serverUrl
        };

        return new Promise((resolve, reject) => {
            this.client.registerAdminRoute(request, (err: any, res: any) => {
                if (err || !res) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.modules);
                }
            })
        });
    }

}
