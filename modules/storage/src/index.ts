import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import {StorageModule} from './Storage';
import fs from "fs";
import path from "path";

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'storage');
    let storage = new StorageModule(grpcSdk);
    let url = storage.url;
    if (process.env.REGISTER_NAME === 'true') {
        url = 'storage:' + url.split(':')[1];
    }

    grpcSdk.config.registerModule('storage', storage.url).catch(err => {
        console.error(err)
        process.exit(-1);
    })
        .then(r => {
            let protofile = fs.readFileSync(path.resolve(__dirname, './routes/router.proto'))
            grpcSdk.router.register(storage.routes, protofile.toString('utf-8'))
        })
        .catch((err: Error) => {
            console.log("Failed to register routes for storage module!")
            console.error(err);
        });
} else {
    throw new Error("Conduit server URL not provided");
}
