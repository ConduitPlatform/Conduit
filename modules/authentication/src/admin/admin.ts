import ConduitGrpcSdk from '@conduit/grpc-sdk';
import grpc from "grpc";
import path from "path";
import {isNil} from 'lodash';

const protoLoader = require('@grpc/proto-loader');

export class AdminHandlers {
    private database: any;

    constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk) {
        const self = this;
        grpcSdk.waitForExistence('database-provider')
            .then(r => {
                self.database = self.grpcSdk.databaseProvider;
            })

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
        // @ts-ignore
        let admin = protoDescriptor.authentication.admin.Admin;
        server.addService(admin.service, {
            getUsers: this.getUsers.bind(this)
        });
    }

    async getUsers(call: any, callback: any) {
        const {skip, limit} = JSON.parse(call.request.params);
        let skipNumber = 0, limitNumber = 25;

        if (!isNil(skip)) {
            skipNumber = Number.parseInt(skip as string);
        }
        if (!isNil(limit)) {
            limitNumber = Number.parseInt(limit as string);
        }

        const usersPromise = this.database.findMany('User', {}, null, skipNumber, limitNumber);
        const countPromise = this.database.countDocuments('User', {});

        let errorMessage: string | null = null;
        const [users, count] = await Promise.all([usersPromise, countPromise]).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({
            code: grpc.status.INTERNAL,
            message: errorMessage,
        });

        return callback(null, {result: JSON.stringify({users, count})});
    }

}
