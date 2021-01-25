import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import fs from "fs";
import path from "path";
import PaymentsModule from './Payments';

if (process.env.CONDUIT_SERVER) {
    let grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'payments');
    let payments = new PaymentsModule(grpcSdk);
    let url = payments.url;
    if (process.env.REGISTER_NAME === 'true') {
        url = 'payments-provider:' + url.split(':')[1];
    }

    grpcSdk.config.registerModule('payments', url).catch((err: any) => {
        console.error(err);
        process.exit(-1);
    });
} else {
    throw new Error('Conduit server URL not provided');
}