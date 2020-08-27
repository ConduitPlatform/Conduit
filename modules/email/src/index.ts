import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import fs from "fs";
import * as path from 'path';
import EmailModule from './Email';

let paths = require("./admin/admin.json")

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER);
    let email = new EmailModule(grpcSdk);
    let url = email.url;
    if(process.env.REGISTER_NAME){
        url = 'email-provider:'+url.split(':')[1];
    
    }
    grpcSdk.config.registerModule('email', url).catch((err: any) => {
        console.error(err)
        process.exit(-1);
    });
    let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
    grpcSdk.admin.register(paths.functions, protofile.toString('utf-8'), url).catch((err: Error) => {
        console.log("Failed to register admin routes for email module!")
        console.error(err);
    });
} else {
    throw new Error("Conduit server URL not provided");
}


