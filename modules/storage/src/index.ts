import ConduitGrpcSdk from '@conduit/grpc-sdk';
import {StorageModule} from './Storage';
import fs from "fs";
import path from "path";

// if (process.env.CONDUIT_SERVER) {
let grpcSdk = new ConduitGrpcSdk("0.0.0.0:8080");
let storage = new StorageModule(grpcSdk);
grpcSdk.config.registerModule('storage', storage.url).catch(err => {
    console.error(err)
    process.exit(-1);
});
let protofile = fs.readFileSync(path.resolve(__dirname, './routes/router.proto'))
grpcSdk.router.register(storage.routes, protofile.toString('UTF-8'), storage.url).catch((err: Error) => {
    console.log("Failed to register routes for storage module!")
    console.error(err);
});
// } else {
//     throw new Error("Conduit server URL not provided");
// }
