import {InMemoryStore} from "./InMemoryStore";
import ConduitGrpcSdk from "@conduit/grpc-sdk";
import fs from "fs";
import * as path from 'path';
import InMemoryStoreConfigSchema from './config/in-memory-store';

let paths = require("./admin/admin.json")

// if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk("0.0.0.0:55152");
    let store = new InMemoryStore(grpcSdk);
    grpcSdk.config.registerModule('in-memory-store', store.url, InMemoryStoreConfigSchema).catch(err => {
        console.error(err)
        process.exit(-1);
    });
    let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
    grpcSdk.admin.register(paths.functions, protofile.toString('UTF-8'),store.url).catch((err: Error) => {
        console.log("Failed to register admin routes for in-memory store module!")
        console.error(err);
    });
// } else {
//     throw new Error("Conduit server URL not provided");
// }


