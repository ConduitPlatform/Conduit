import {InMemoryStore} from "./InMemoryStore";
import ConduitGrpcSdk from "@conduit/grpc-sdk";
import fs from "fs";

let paths = require("./admin/admin.json")

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER);
    new InMemoryStore(grpcSdk);
    let protofile = fs.readFileSync('./admin/admin.proto')
    grpcSdk.admin.register(paths.functions, protofile.toString('UTF-8')).catch((err: Error) => {
        console.log("Failed to register admin routes for in-memory store module!")
        console.error(err);
    });
} else {
    throw new Error("Conduit server URL not provided");
}


