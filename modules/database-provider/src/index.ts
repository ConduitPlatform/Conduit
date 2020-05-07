import {DatabaseProvider} from "./databaseProvider";
import ConduitGrpcSdk from "@conduit/grpc-sdk";

// if (process.env.CONDUIT_SERVER) {
let grpcSdk = new ConduitGrpcSdk("0.0.0.0:55152");
let store = new DatabaseProvider(grpcSdk);
grpcSdk.config.registerModule('database-provider', store.url).catch(err => {
    console.error(err)
    process.exit(-1);
});
// } else {
//     throw new Error("Conduit server URL not provided");
// }
