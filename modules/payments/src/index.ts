import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import fs from "fs";
import path from "path";
import PaymentsModule from './Payments';

let paths = require("./admin/admin.json")

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'payments');
    let payments = new PaymentsModule(grpcSdk);
    let url = payments.url;
    if (process.env.REGISTER_NAME === 'true') {
        url = 'payments-provider:' + url.split(':')[1];
    }

    grpcSdk.config.registerModule('payments', url).catch((err: any) => {
        console.error(err);
        process.exit(-1);
    })
        .then(r => {
            let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
            grpcSdk.admin.register(paths.functions, protofile.toString('utf-8'))
        }).catch((err: Error) => {
        console.log("Failed to register admin routes for payments module!");
        console.error(err);
    })
} else {
    throw new Error('Conduit server URL not provided');
}
