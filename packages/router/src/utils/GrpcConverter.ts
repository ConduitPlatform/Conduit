import path from "path";
import fs from "fs";
import grpc from "grpc";
import {ConduitRoute, ConduitRouteParameters} from '@quintessential-sft/conduit-sdk';

let protoLoader = require('@grpc/proto-loader');

export function grpcToConduitRoute(request: any): ConduitRoute[] {
    let finalRoutes: ConduitRoute[] = [];
    let protofile = request.protoFile
    let routes: [{ options: any, returns: any, grpcFunction: string, isMiddleware: boolean }] = request.routes;
    let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
    fs.writeFileSync(protoPath, protofile);
    var packageDefinition = protoLoader.loadSync(
        protoPath,
        {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
        });
    let routerDescriptor: any = grpc.loadPackageDefinition(packageDefinition);
    //this can break everything change it
    while (Object.keys(routerDescriptor)[0] !== 'Router') {
        routerDescriptor = routerDescriptor[Object.keys(routerDescriptor)[0]];
    }
    routerDescriptor = routerDescriptor[Object.keys(routerDescriptor)[0]];
    let serverIp = request.routerUrl;
    let client = new routerDescriptor(serverIp, grpc.credentials.createInsecure())
    routes.forEach(r => {
        let handler = (req: ConduitRouteParameters) => {
            let request = {
                params: req.params ? JSON.stringify(req.params) : null,
                path: req.path,
                headers: JSON.stringify(req.headers),
                context: JSON.stringify(req.context)
            }
            return new Promise((resolve, reject) => {
                client[r.grpcFunction](request, (err: any, result: any) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            })
        }
        let options: any = r.options;
        for (let k in options) {
            if (!options.hasOwnProperty(k) || options[k].length === 0) continue;
            try {
                options[k] = JSON.parse(options[k]);
            } catch (e) {
            }
        }

        let returns: any = r.returns;
        for (let k in returns) {
            if (!returns.hasOwnProperty(k) || returns[k].length === 0) continue;
            try {
                returns[k] = JSON.parse(returns[k]);
            } catch (e) {
            }
        }
        finalRoutes.push(new ConduitRoute(options, returns, handler, r.isMiddleware));
    })
    return finalRoutes;
}
