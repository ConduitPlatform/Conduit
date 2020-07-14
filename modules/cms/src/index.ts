import ConduitGrpcSdk from "@conduit/grpc-sdk";
import fs from "fs";
import * as path from 'path';
import {CMS} from './CMS';

let paths = require("./admin/admin.json")

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER);
    let cms = new CMS(grpcSdk);
    grpcSdk.config.registerModule('cms', cms.url).catch(err => {
        console.error(err)
        process.exit(-1);
    });
    let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
    grpcSdk.admin.register(paths.functions, protofile.toString('utf-8'), cms.url).catch((err: Error) => {
        console.log("Failed to register admin routes for CMS module!")
        console.error(err);
    });


} else {
    throw new Error("Conduit server URL not provided");
}
