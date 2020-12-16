import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import grpc from "grpc";
import {isNil} from 'lodash';
import path from "path";
import {ISmsProvider} from '../interfaces/ISmsProvider';

const protoLoader = require('@grpc/proto-loader');

export class AdminHandlers {

    private provider: ISmsProvider | undefined;

    constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk, provider: ISmsProvider | undefined) {
        this.provider = provider;
        let packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, './admin.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            }
        );
        let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        // The protoDescriptor object has the full package hierarchy
        // @ts-ignore
        let admin = protoDescriptor.sms.admin.Admin;
        server.addService(admin.service, {
            sendSms: this.sendSms.bind(this)
        });
    }

    updateProvider(provider: ISmsProvider) {
        this.provider = provider;
    }

    async sendSms(call: any, callback: any) {
        const { to, message } = JSON.parse(call.request.params);
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
