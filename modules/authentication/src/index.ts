import ConduitGrpcSdk from "@conduit/grpc-sdk";
import fs from "fs";
import * as path from 'path';
import AuthenticationModule from './Authentication';
import { isNil } from "lodash";

let paths = require("./admin/admin.json")

// if (process.env.CONDUIT_SERVER) {
let grpcSdk = new ConduitGrpcSdk("0.0.0.0:55152");
let authentication = new AuthenticationModule(grpcSdk);
grpcSdk.config.registerModule('authentication', authentication.url).catch(err => {
  console.error(err)
  process.exit(-1);
});
let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
grpcSdk.admin.register(paths.functions, protofile.toString('UTF-8'),authentication.url).catch((err: Error) => {
  console.log("Failed to register admin routes for authentication module!")
  console.error(err);
});
let routerProtoFile = fs.readFileSync(path.resolve(__dirname, './routes/router.proto'));

getAuthRoutes(authentication)
  .then((authRoutes: any[]) => {
    return grpcSdk.router.register(authRoutes, routerProtoFile.toString('UTF-8'), authentication.url);
  })
  .catch((err: Error) => {
    console.log('Failed to register routes for authentication module');
    console.log(err);
  });
// } else {
//     throw new Error("Conduit server URL not provided");
// }
async function getAuthRoutes(authentication: any): Promise<any> {
  let authRoutes = authentication.routes;
  if (isNil(authRoutes)) {
    await new Promise(r => setTimeout(r, 2000));
    return getAuthRoutes(authentication);
  }
  return authRoutes;
}
