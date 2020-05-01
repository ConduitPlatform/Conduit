import * as grpc from 'grpc';
import {RouterClient} from "@conduit/protos/dist/src/core_grpc_pb";
import {RegisterConduitRouteRequest} from "@conduit/protos/dist/src/core_pb";
import PathDefinition = RegisterConduitRouteRequest.PathDefinition;

export default class Router {
    private readonly client: RouterClient;

    constructor(url: string) {
        this.client = new RouterClient(url, grpc.credentials.createInsecure());
    }

    register(paths: any[], protoFile: string): Promise<any> {
        let request = new RegisterConduitRouteRequest();
        let grpcPathArray: PathDefinition[] = [];
        paths.forEach(r => {
            let obj = new PathDefinition();
            obj.setPath(r.path);
            obj.setMethod(r.method);
            obj.setInputs(JSON.stringify(r.inputs));
            obj.setGrpcfunction(r.protoName);
            grpcPathArray.push(obj);
        })
        request.setRoutesList(grpcPathArray);
        request.setProtofile(protoFile);
        return new Promise((resolve, reject) => {
            this.client.registerConduitRoute(request, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve("OK");
                }
            })
        });
    }

}
