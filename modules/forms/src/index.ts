import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import FormsModule from './Forms';

let paths = require("./admin/admin.json")

if (!process.env.CONDUIT_SERVER) {
    throw new Error("Conduit server URL not provided");
}
let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'forms');
let forms = new FormsModule(grpcSdk);
let url = forms.url;
if (process.env.REGISTER_NAME === 'true') {
    url = 'forms:' + url.split(':')[1];
}
grpcSdk.config.registerModule('forms', url).catch(err => {
    console.error(err)
    process.exit(-1);
})
    .then(() => {
        grpcSdk.admin.register(paths.functions)
    }).catch((err: Error) => {
    console.log("Failed to register admin routes for forms module!")
    console.error(err);
});
