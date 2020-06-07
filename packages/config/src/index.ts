import * as grpc from "grpc";
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import {isNil} from "lodash";
import {DatabaseConfigUtility} from './utils/config';
import {Config} from 'convict';
import AppConfigSchema from './utils/config/schema/config';
import {ConduitSDK, IConfigManager} from '@conduit/sdk';
import {EventEmitter} from "events";
import {AdminHandlers} from './admin/admin';
import {NextFunction, Request, Response} from 'express';

export default class ConfigManager implements IConfigManager {

    databaseCallback: any;
    registeredModules: Map<string, string> = new Map<string, string>();
    grpcSdk: ConduitGrpcSdk;
    moduleRegister: EventEmitter;

    constructor(grpcSdk: ConduitGrpcSdk, private readonly sdk: ConduitSDK, server: grpc.Server, packageDefinition: any, databaseCallback: any) {
        var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        this.grpcSdk = grpcSdk;
        // @ts-ignore
        var config = protoDescriptor.conduit.core.Config;
        server.addService(config.service, {
            get: this.getGrpc.bind(this),
            updateConfig: this.updateConfig.bind(this),
            moduleExists: this.moduleExists.bind(this),
            registerModule: this.registerModule.bind(this),
            moduleList: this.moduleList.bind(this),
            watchModules: this.watchModules.bind(this)
        })
        this.databaseCallback = databaseCallback;
        this.moduleRegister = new EventEmitter();
    }

    initConfigAdminRoutes() {
        this.registerAdminRoutes();
    }

    async registerAppConfig() {
        await this.getDatabaseConfigUtility().registerConfigSchemas(AppConfigSchema);
    }


    getDatabaseConfigUtility() {
        return new DatabaseConfigUtility(this.grpcSdk);
    }

    getGrpc(call: any, callback: any) {
        this.get(call.request.key)
            .then(r => {
                callback(null, {data: JSON.stringify(r)})
            })
            .catch(err => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message ? err.message : err,
                });
            })
    }


    async get(name: string) {
        if (!isNil(this.grpcSdk.databaseProvider)) {
            return this.grpcSdk.databaseProvider!.findOne('Config', {})
                .then(async (dbConfig: any) => {
                    if (isNil(dbConfig)) throw new Error('Config not found in the database');
                    if (isNil(dbConfig['moduleConfigs'][name])) throw new Error(`Config for module "${name} not set`);
                    return dbConfig['moduleConfigs'][name]
                })

        } else {
            throw new Error("Database provider not set");
        }

    }

    updateConfig(call: any, callback: any) {
        const newConfig = JSON.parse(call.request.config);
        if (!isNil(this.grpcSdk.databaseProvider)) {
            this.grpcSdk.databaseProvider!.findOne('Config', {})
                .then(dbConfig => {
                    if (isNil(dbConfig)) throw new Error('Config not found in the database');
                    if (!dbConfig['moduleConfigs']) {
                        dbConfig['moduleConfigs'] = {};
                    }
                    let modName = "moduleConfigs." + call.request.moduleName
                    return this.grpcSdk.databaseProvider!.findByIdAndUpdate('Config', dbConfig._id, {$set: {[modName]: newConfig}})
                        .then((updatedConfig: any) => {
                            delete updatedConfig._id;
                            delete updatedConfig.createdAt;
                            delete updatedConfig.updatedAt;
                            delete updatedConfig.__v;
                            return callback(null, {result: JSON.stringify(updatedConfig['moduleConfigs'][call.request.moduleName])})
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

    async registerModulesConfig(name: string, newModulesConfigSchemaFields: any) {
        await this.grpcSdk.waitForExistence('database-provider');
        this.grpcSdk.databaseProvider!.findOne('Config', {})
            .then(dbConfig => {
                if (isNil(dbConfig)) throw new Error('Config not found in the database');
                if (!dbConfig['moduleConfigs']) {
                    dbConfig['moduleConfigs'] = {};
                }
                let modName = "moduleConfigs." + name
                return this.grpcSdk.databaseProvider!.findByIdAndUpdate('Config', dbConfig._id, {$set: {[modName]: newModulesConfigSchemaFields}})
                    .then((updatedConfig: any) => {
                        delete updatedConfig._id;
                        delete updatedConfig.createdAt;
                        delete updatedConfig.updatedAt;
                        delete updatedConfig.__v;
                        return updatedConfig['moduleConfigs'][name]
                    })
            });

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

    watchModules(call: any, callback: any) {
        const self = this;
        this.moduleRegister.on('module-registered', () => {
            let modules: any[] = [];
            self.registeredModules.forEach((value: string, key: string) => {
                modules.push({
                    moduleName: key,
                    url: value
                })
            });
            call.write({modules})
        })
        // todo this should close gracefully I guess.
    }

    async registerModule(call: any, callback: any) {
        this.registeredModules.set(call.request.moduleName, call.request.url);
        if (call.request.moduleName === 'database-provider') {
            this.databaseCallback();
        }
        this.moduleRegister.emit('module-registered');
        callback(null, {result: true});
    }

    private registerAdminRoutes() {
        const adminHandlers = new AdminHandlers(this.grpcSdk, this.sdk);
        const adminModule = this.sdk.getAdmin();

        adminModule.registerRoute('GET', '/config/modules', (req: Request, res: Response, next: NextFunction) => {
            if (isNil((req as any).conduit)) {
                (req as any).conduit = {};
            }
            (req as any).conduit.registeredModules = this.registeredModules;
            return adminHandlers.getModules(req, res);
        });

        adminModule.registerRoute('GET', '/config/:module?', (req: Request, res: Response, next: NextFunction) => {
            if (isNil((req as any).conduit)) {
                (req as any).conduit = {};
            }
            (req as any).conduit.registeredModules = this.registeredModules;
            return adminHandlers.getConfig(req, res);
        });

        adminModule.registerRoute('PUT', '/config/:module?', (req: Request, res: Response, next: NextFunction) => {
            if (isNil((req as any).conduit)) {
                (req as any).conduit = {};
            }
            (req as any).conduit.registeredModules = this.registeredModules;
            return adminHandlers.setConfig(req, res);
        });

    }

}
