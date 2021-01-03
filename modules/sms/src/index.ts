import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import fs from "fs";
import path from "path";
import SmsModule from './Sms';
let paths = require("./admin/admin.json");

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'sms');
    let sms = new SmsModule(grpcSdk);
    let url = sms.url;
    if (process.env.REGISTER_NAME === 'true') {
        url = 'sms-provider:' + url.split(':')[1];
    }

    grpcSdk.config.registerModule('sms', url).catch((err: any) => {
        console.error(err);
        process.exit(-1);
    });
    let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'));
    grpcSdk.admin.register(paths.functions, protofile.toString('utf-8'), url).catch((err: Error) => {
        console.log('Failed to register admin routes for sms module!');
        console.error(err);
    });
} else {
    throw new Error('Conduit server URL not provided');
}