import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import EmailModule from './Email';
import process from "process";

let paths = require("./admin/admin.json")

if (!process.env.CONDUIT_SERVER) {
    throw new Error("Conduit server URL not provided");
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'email');
let email = new EmailModule(grpcSdk);
let url = email.url;
if (process.env.REGISTER_NAME === 'true') {
    url = 'email-provider:' + url.split(':')[1];

}
grpcSdk.config.registerModule('email', url).catch((err: any) => {
    console.error(err)
    process.exit(-1);
})
    .then(() => {
        grpcSdk.admin.register(paths.functions)
    }).catch((err: Error) => {
    console.log("Failed to register admin routes for email module!")
    console.error(err);
});

