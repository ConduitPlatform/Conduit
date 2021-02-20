import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import PaymentsModule from './Payments';

let paths = require("./admin/admin.json")

if (!process.env.CONDUIT_SERVER) {
    throw new Error("Conduit server URL not provided");
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'payments');
let payments = new PaymentsModule(grpcSdk);
let url = payments.url;
if (process.env.REGISTER_NAME === 'true') {
    url = 'payments-provider:' + url.split(':')[1];
}

grpcSdk.config.registerModule('payments', url).catch((err: any) => {
    console.error(err);
    process.exit(-1);
})
    .then(() => {
        grpcSdk.admin.register(paths.functions)
    }).catch((err: Error) => {
    console.log("Failed to register admin routes for payments module!");
    console.error(err);
})
