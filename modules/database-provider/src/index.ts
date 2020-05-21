import {DatabaseProvider} from "./DatabaseProvider";
import ConduitGrpcSdk from "@conduit/grpc-sdk";

// if (process.env.CONDUIT_SERVER) {
let grpcSdk = new ConduitGrpcSdk("0.0.0.0:55152");
let databaseProvider = new DatabaseProvider(grpcSdk);
databaseProvider.ensureIsRunning().then(() => {
    grpcSdk.config.registerModule('database-provider', databaseProvider.url).catch(err => {
        console.error(err)
        process.exit(-1);
    });
});

// } else {
//     throw new Error("Conduit server URL not provided");
// }
