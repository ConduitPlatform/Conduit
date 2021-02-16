import fs from "fs";
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import * as path from 'path';
import AuthenticationModule from './Authentication';

let paths = require("./admin/admin.json")

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'authentication');
    let authentication = new AuthenticationModule(grpcSdk);
    let url = authentication.url;
    if (process.env.REGISTER_NAME === 'true') {
        url = 'authentication:' + url.split(':')[1];
    }
    grpcSdk.config.registerModule('authentication', url)
        .catch((err: any) => {
            console.error(err)
            process.exit(-1);
        })
        .then((r: any) => {
            let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
            return grpcSdk.admin.register(paths.functions, protofile.toString('utf-8'))
        })
        .catch((err: Error) => {
            console.log("Failed to register admin routes for authentication module!")
            console.error(err);
        });
} else {
    throw new Error("Conduit server URL not provided");
}
