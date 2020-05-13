import * as grpc from "grpc";
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import {isNil} from "lodash";


export default class ConfigManager {

    databaseCallback: any;
    registeredModules: Map<string, string> = new Map<string, string>();
    grpcSdk: ConduitGrpcSdk;

    constructor(grpcSdk: ConduitGrpcSdk, server: grpc.Server, packageDefinition: any, databaseCallback: any) {
        var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        this.grpcSdk = grpcSdk;
        // @ts-ignore
        var config = protoDescriptor.conduit.core.Config;
        server.addService(config.service, {
            get: this.get.bind(this),
            updateConfig: this.updateConfig.bind(this),
            moduleExists: this.moduleExists.bind(this),
            registerModule: this.registerModule.bind(this),
            moduleList: this.moduleList.bind(this),
        })
        this.databaseCallback = databaseCallback;
    }

    get(call: any, callback: any) {
        if (!isNil(this.grpcSdk.databaseProvider)) {
            this.grpcSdk.databaseProvider!.findOne('Config', {})
                .then(dbConfig => {
                    if (isNil(dbConfig)) throw new Error('Config not found in the database');
                    return callback(null, {data: JSON.stringify(dbConfig[call.request.key])})
                })
                .catch(err => {
                    callback({
                        code: grpc.status.INTERNAL,
                        message: err.message ? err.message : err,
                    });
                })
        } else {
            callback({
                code: grpc.status.FAILED_PRECONDITION,
                message: "Database provider not set",
            });
        }

    }

    updateConfig(call: any, callback: any) {
        const newConfig = JSON.parse(call.request.config);
        if (!isNil(this.grpcSdk.databaseProvider)) {
            this.grpcSdk.databaseProvider!.findOne('Config', {})
                .then(dbConfig => {
                    if (isNil(dbConfig)) throw new Error('Config not found in the database');
                    dbConfig[call.request.moduleName] = newConfig;
                    return this.grpcSdk.databaseProvider!.findByIdAndUpdate('Config', dbConfig)
                        .then((updatedConfig: any) => {
                            return callback(null, {result: JSON.stringify(updatedConfig[call.request.moduleName])})
                        })
                })
                .catch(err => {
                    callback({
                        code: grpc.status.INTERNAL,
                        message: err.message ? err.message : err,
                    });
                });
        } else {
            callback({
                code: grpc.status.FAILED_PRECONDITION,
                message: "Database provider not set",
            });
        }
    }

    moduleExists(call: any, callback: any) {
        if (this.registeredModules.has(call.request.moduleName)) {
            callback(null, this.registeredModules.get(call.request.moduleName));
        } else {
            callback({
                code: grpc.status.NOT_FOUND,
                message: "Module is missing",
            });
        }
    }

    moduleList(call: any, callback: any) {
        if (this.registeredModules.size !== 0) {
            let modules: any[] = [];
            this.registeredModules.forEach((value: string, key: string) => {
                modules.push({
                    moduleName: key,
                    url: value
                })
            });
            callback(null, {modules})
        } else {
            callback({
                code: grpc.status.NOT_FOUND,
                message: "Modules not available",
            })
        }
    }

    registerModule(call: any, callback: any) {
        this.registeredModules.set(call.request.moduleName, call.request.url);
        if (call.request.moduleName === 'database-provider') {
            this.databaseCallback();
        }
        callback(null, {result: true});
    }


}
