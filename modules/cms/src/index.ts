import ConduitGrpcSdk from "@conduit/grpc-sdk";
import fs from "fs";
import * as path from 'path';
import { CMS } from './CMS';

let paths = require("./admin/admin.json")

// if (process.env.CONDUIT_SERVER) {
let grpcSdk = new ConduitGrpcSdk("0.0.0.0:55152");
let store = new CMS(grpcSdk);
grpcSdk.config.registerModule('cms', store.url).catch(err => {
  console.error(err)
  process.exit(-1);
});
let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
grpcSdk.admin.register(paths.functions, protofile.toString('UTF-8'),store.url).catch((err: Error) => {
  console.log("Failed to register admin routes for CMS module!")
  console.error(err);
});
let routesProtoFile = fs.readFileSync(path.resolve(__dirname, './routes/router.proto'));
grpcSdk.router.register(store.routes, routesProtoFile.toString('UTF-8'), store.url).catch((err: Error) => {
  console.log("Failed to register routes for CMS module!")
  console.error(err);
});
// } else {
//     throw new Error("Conduit server URL not provided");
// }
