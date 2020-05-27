import fs from "fs";
import path from "path";
import PushNotifications from './PushNotifications';
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import PushNotificationsConfigSchema from './config/push-notifications';
let paths = require("./admin/admin.json")


// if (process.env.CONDUIT_SERVER) {
let grpcSdk = new ConduitGrpcSdk("0.0.0.0:55152");
let notifications = new PushNotifications(grpcSdk);
grpcSdk.config.registerModule("push-notifications", notifications.url, PushNotificationsConfigSchema).catch(err => {
    console.error(err)
    process.exit(-1);
});
let protofile = fs.readFileSync(path.resolve(__dirname, './admin/admin.proto'))
grpcSdk.admin.register(paths.functions, protofile.toString('UTF-8'),notifications.url).catch((err: Error) => {
    console.log("Failed to register admin routes for push-notifications module!")
    console.error(err);
});
let routerProtoFile = fs.readFileSync(path.resolve(__dirname, './routes/router.proto'));
grpcSdk.router.register(notifications.routes, routerProtoFile.toString('UTF-8'), notifications.url).catch((err: Error) => {
    console.log('Failed to register routes for push notifications module');
    console.log(err);
});
// } else {
//     throw new Error("Conduit server URL not provided");
// }


