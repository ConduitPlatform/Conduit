import ConduitGrpcSdk, {GrpcServer} from '@quintessential-sft/conduit-grpc-sdk';
import grpc from "grpc";
import {isNil} from 'lodash';
import {ServiceAdmin} from './service';

let paths = require("./admin.json").functions
export class AdminHandlers {
    private database: any;

    constructor(server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
        const self = this;
        grpcSdk.waitForExistence('database-provider')
            .then(() => {
                self.database = self.grpcSdk.databaseProvider;
            })
        let serviceAdmin = new ServiceAdmin(this.grpcSdk);
        this.grpcSdk.admin.registerAdmin(server, paths, {
            getUsers: this.getUsers.bind(this),
            getServices: serviceAdmin.getServices.bind(serviceAdmin),
            createService: serviceAdmin.createService.bind(serviceAdmin),
            renewServiceToken: serviceAdmin.renewToken.bind(serviceAdmin)
        }).catch((err: Error) => {
            console.log("Failed to register admin routes for module!")
            console.error(err);
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
