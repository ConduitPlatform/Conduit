import {DatabaseProvider} from "./DatabaseProvider";
import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";
import process from "process";

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER);
    let databaseProvider = new DatabaseProvider(grpcSdk);
    databaseProvider.ensureIsRunning().then(() => {
        let url = databaseProvider.url;
        if(process.env.REGISTER_NAME === 'true'){
            url = 'database-provider:'+url.split(':')[1];
        }
        grpcSdk.config.registerModule('database-provider', url)
        .catch((err: any) => {
            console.error(err)
            process.exit(-1);
        });
        
    });
} else {
    throw new Error("Conduit server URL not provided");
}
