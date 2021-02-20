import ConduitGrpcSdk, {addServiceToServer} from '@quintessential-sft/conduit-grpc-sdk';
import grpc from "grpc";
import path from "path";
import {isNil} from 'lodash';
import {ServiceAdmin} from './service';

export class AdminHandlers {
    private database: any;

    constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk) {
        const self = this;
        grpcSdk.waitForExistence('database-provider')
            .then(r => {
                self.database = self.grpcSdk.databaseProvider;
            })
        let serviceAdmin = new ServiceAdmin(this.grpcSdk);
        addServiceToServer(server, path.resolve(__dirname, path.resolve(__dirname, './admin.proto')),
            "authentication.admin.Admin", {
                getUsers: this.getUsers.bind(this),
                getServices: serviceAdmin.getServices.bind(serviceAdmin),
                createService: serviceAdmin.createService.bind(serviceAdmin),
                renewServiceToken: serviceAdmin.renewToken.bind(serviceAdmin)
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
