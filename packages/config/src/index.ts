import * as grpc from "grpc";
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import {isNil} from "lodash";
import {DatabaseConfigUtility} from './utils/config';
import {Config} from 'convict';
import {AppConfig} from './utils/config';
import { ConduitSDK, IConfigManager } from '@conduit/sdk';
import {EventEmitter} from "events";
import { AdminHandlers } from './admin/admin';
import { NextFunction, Request, Response } from 'express';
import { ConfigModelGenerator } from './models/Config';

export default class ConfigManager implements IConfigManager {

    databaseCallback: any;
    registeredModules: Map<string, string> = new Map<string, string>();
    grpcSdk: ConduitGrpcSdk;
    conduitConfig: any;
    moduleRegister: EventEmitter;

    constructor(grpcSdk: ConduitGrpcSdk, private readonly sdk: ConduitSDK, server: grpc.Server, packageDefinition: any, databaseCallback: any) {
        var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        this.grpcSdk = grpcSdk;
        this.conduitConfig = this.appConfig.config;
        (sdk as any).config = this.appConfig.config;
        // @ts-ignore
        var config = protoDescriptor.conduit.core.Config;
        server.addService(config.service, {
            get: this.get.bind(this),
            updateConfig: this.updateConfig.bind(this),
            moduleExists: this.moduleExists.bind(this),
            registerModule: this.registerModule.bind(this),
            moduleList: this.moduleList.bind(this),
            watchModules: this.watchModules.bind(this),
        })
        this.databaseCallback = databaseCallback;
        this.moduleRegister = new EventEmitter();
    }

    initConfigAdminRoutes() {
        this.registerAdminRoutes();
    }

    async registerConfigSchemas(): Promise<any> {
        await this.grpcSdk.waitForExistence('database-provider');
        const database = this.grpcSdk.databaseProvider;
        const ConfigModel = new ConfigModelGenerator(this.sdk).configModel;
        return database!.createSchemaFromAdapter(ConfigModel);
    }

    getDatabaseConfigUtility(appConfig: Config<any>) {
        return new DatabaseConfigUtility(this.grpcSdk.databaseProvider!, appConfig);
    }

    get appConfig() {
        return AppConfig.getInstance();
    }

    get(call: any, callback: any) {
        if (!isNil(this.grpcSdk.databaseProvider)) {
            this.grpcSdk.databaseProvider!.findOne('Config', {})
                .then(dbConfig => {
                    if (isNil(dbConfig)) throw new Error('Config not found in the database');
                    if (isNil(dbConfig[call.request.key])) throw new Error(`Config for module "${call.request.key} not set`);
                    // TODO set config for not set module
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
                    Object.assign(dbConfig[call.request.moduleName], newConfig);
                    return this.grpcSdk.databaseProvider!.findByIdAndUpdate('Config', dbConfig)
                        .then((updatedConfig: any) => {
                            delete updatedConfig._id;
                            delete updatedConfig.createdAt;
                            delete updatedConfig.updatedAt;
                            delete updatedConfig.__v;
                            this.conduitConfig.load(updatedConfig);
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

    watchModules(call: any, callback: any) {
        const self = this;
        this.moduleRegister.on('module-registered',  ()=>{
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

    async registerModulesConfigSchema(newModulesConfigSchema: any) {
        AppConfig.getInstance().addModulesConfigSchema(newModulesConfigSchema);
        await this.registerConfigSchemas();
    }

    async registerModule(call: any, callback: any) {
        this.registeredModules.set(call.request.moduleName, call.request.url);
        if (call.request.moduleName === 'database-provider') {
            this.databaseCallback();
        }
        if (call.request.newConfigSchema !== '') {
            const newConfigSchema = JSON.parse(call.request.newConfigSchema);
            let errorMessage = null;
            await this.registerModulesConfigSchema(newConfigSchema).catch(e=> errorMessage = e.message);
            if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
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
