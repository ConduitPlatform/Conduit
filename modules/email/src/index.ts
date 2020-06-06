import ConduitGrpcSdk from "@conduit/grpc-sdk";
import fs from "fs";
import * as path from 'path';
import EmailModule from './Email';

let paths = require("./admin/admin.json")

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER);
    let email = new EmailModule(grpcSdk);
    grpcSdk.config.registerModule('email', email.url).catch((err: any) => {
        console.error(err)
        process.exit(-1);
    });
    let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
    grpcSdk.admin.register(paths.functions, protofile.toString('UTF-8'), email.url).catch((err: Error) => {
        console.log("Failed to register admin routes for email module!")
        console.error(err);
    });
} else {
    throw new Error("Conduit server URL not provided");
}


