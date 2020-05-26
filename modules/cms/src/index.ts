import ConduitGrpcSdk from "@conduit/grpc-sdk";
import fs from "fs";
import * as path from 'path';
import { CMS } from './CMS';
import { isNil } from "lodash";

let paths = require("./admin/admin.json")

// if (process.env.CONDUIT_SERVER) {
let grpcSdk = new ConduitGrpcSdk("0.0.0.0:55152");
let cms = new CMS(grpcSdk);
grpcSdk.config.registerModule('cms', cms.url).catch(err => {
  console.error(err)
  process.exit(-1);
});
let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
grpcSdk.admin.register(paths.functions, protofile.toString('UTF-8'),cms.url).catch((err: Error) => {
  console.log("Failed to register admin routes for CMS module!")
  console.error(err);
});
getCmsRoutes(cms)
  .then((cmsRoutes: any[]) => {
    let routesProtoFile = fs.readFileSync(path.resolve(__dirname, './routes/router.proto'));
    return grpcSdk.router.register(cmsRoutes, routesProtoFile.toString('UTF-8'), cms.url);
  })
  .catch((err: Error) => {
    console.log("Failed to register routes for CMS module!")
    console.error(err);
  });

// } else {
//     throw new Error("Conduit server URL not provided");
// }
async function getCmsRoutes(CMS: any): Promise<any> {
  let cmsRoutes = CMS.routes;
  if (isNil(cmsRoutes)) {
    await new Promise(r => setTimeout(r, 2000));
    return getCmsRoutes(CMS);
  }
  console.log(cmsRoutes)
  return cmsRoutes;
}
