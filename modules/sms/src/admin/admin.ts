import ConduitGrpcSdk, {GrpcServer} from '@quintessential-sft/conduit-grpc-sdk';
import grpc from "grpc";
import {isNil} from 'lodash';
import {ISmsProvider} from '../interfaces/ISmsProvider';

let paths = require("./admin.json").functions

export class AdminHandlers {

    private provider: ISmsProvider | undefined;

    constructor(server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk, provider: ISmsProvider | undefined) {
        this.provider = provider;

        this.grpcSdk.admin.registerAdmin(server, paths.functions, {
            sendSms: this.sendSms.bind(this)
        }).catch((err: Error) => {
            console.log("Failed to register admin routes for module!")
            console.error(err);
        });
    }

    updateProvider(provider: ISmsProvider) {
        this.provider = provider;
    }

    async sendSms(call: any, callback: any) {
        const {to, message} = JSON.parse(call.request.params);
        let errorMessage: string | null = null;

        if (isNil(this.provider)) {
            return callback({code: grpc.status.INTERNAL, message: 'No sms provider'});
        }

        await this.provider.sendSms(to, message)
            .catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({
            code: grpc.status.INTERNAL,
            message: errorMessage
        });

        return callback(null, {result: JSON.stringify({message: 'SMS sent'})});
    }
}
