import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import AuthenticationModule from './Authentication';

if (!process.env.CONDUIT_SERVER) {
    throw new Error("Conduit server URL not provided");
}

let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'authentication');
let authentication = new AuthenticationModule(grpcSdk);
let url = authentication.url;
if (process.env.REGISTER_NAME === 'true') {
    url = 'authentication:' + url.split(':')[1];
}
grpcSdk.config
    .registerModule('authentication', url)
    .catch((err: any) => {
        console.error(err)
        process.exit(-1);
    })
