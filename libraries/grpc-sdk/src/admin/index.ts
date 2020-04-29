import * as grpc from 'grpc';
import {ConfigClient} from '@conduit/protos/dist/src/config_grpc_pb';
import {GetRequest, ModuleExistsRequest, UpdateRequest} from "@conduit/protos/dist/src/config_pb";
import {AdminClient} from "@conduit/protos/dist/src/admin_grpc_pb";
import {RegisterAdminRouteRequest} from "@conduit/protos/dist/src/admin_pb";
import PathDefinition = RegisterAdminRouteRequest.PathDefinition;

export default class Admin {
    private readonly client: AdminClient;

    constructor(url: string) {
        this.client = new AdminClient(url, grpc.credentials.createInsecure());
    }

    register(paths: any[], protoFile: string): Promise<any> {
        let request = new RegisterAdminRouteRequest();
        let grpcPathArray: PathDefinition[] = [];
        paths.forEach(r => {
            let obj = new PathDefinition();
            obj.setPath(r.path);
            obj.setGrpcfunction(r.protoName);
            grpcPathArray.push(obj);
        })
        request.setRoutesList(grpcPathArray);
        request.setProtofile(protoFile);
        return new Promise((resolve, reject) => {
            this.client.registerAdminRoute(request, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve("OK");
                }
            })
        });
    }

}
