import fs from "fs";
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import * as path from 'path';
import FormsModule from './Forms';

let paths = require("./admin/admin.json")

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'forms');
    let forms = new FormsModule(grpcSdk);
    let url = forms.url;
    if (process.env.REGISTER_NAME === 'true') {
        url = 'forms:' + url.split(':')[1];
    }
    grpcSdk.config.registerModule('forms', url).catch(err => {
        console.error(err)
        process.exit(-1);
    })
        .then(r => {
            let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
            grpcSdk.admin.register(paths.functions, protofile.toString('utf-8'))
        }).catch((err: Error) => {
        console.log("Failed to register admin routes for forms module!")
        console.error(err);
    });
} else {
    throw new Error("Conduit server URL not provided");
}
