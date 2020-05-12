import Config from "./config";
import Admin from "./admin";
import Router from "./router";
import * as grpc from "grpc";
import InMemoryStore from "./inMemoryStore";
import DatabaseProvider from "./databaseProvider";
import { Config as ConvictConfig } from 'convict';
import { isNil, merge, isPlainObject } from "lodash";
import validator from "validator";
import isNaturalNumber = require("is-natural-number");


export default class ConduitGrpcSdk {

    private readonly serverUrl: string;
    private readonly _config: Config;
    private readonly _admin: Admin;
    private readonly _router: Router;
    private readonly _modules: any = {};
    private readonly _availableModules: any = {
        "in-memory-store": InMemoryStore,
        "database-provider": DatabaseProvider
    }
    private lastSearch: number = Date.now();

    constructor(serverUrl: string) {
        this.serverUrl = serverUrl;
        this._config = new Config(this.serverUrl);
        this._admin = new Admin(this.serverUrl);
        this._router = new Router(this.serverUrl);
        this.initializeModules();
        // service discovery should be better
        setInterval(() => {
            this.initializeModules()
        }, 3000);
    }

    /**
     * Gets all the registered modules from the config and creates clients for them.
     * This will only work on known modules, since the primary usage for the sdk is internal
     */
    initializeModules() {
        return this._config
            .moduleList()
            .then(r => {
                this.lastSearch = Date.now();
                r.forEach(m => {
                    if (!this._modules[m.moduleName] && this._availableModules[m.moduleName]) {
                        this._modules[m.moduleName] = new this._availableModules[m.moduleName](m.url);
                    }
                })
                return "ok"
            })
            .catch(err => {
                if (err.code !== 5) {
                    console.error(err);
                }
            })
    }

    /**
     * Used to refresh all modules to check for new registrations
     * @param force If true will check for new modules no matter the interval
     */
    async refreshModules(force?: boolean) {
        if (this.lastSearch < (Date.now() - 3000) || force) {
            return this.initializeModules();
        }
        return "ok";
    }

    get config(): Config {
        return this._config;
    }

    get admin(): Admin {
        return this._admin;
    }

    get router(): Router {
        return this._router;
    }

    get inMemoryStore(): InMemoryStore | null {
        if (this._modules["in-memory-store"]) {
            return this._modules["in-memory-store"];
        } else {
            console.warn("In memory store not up yet!")
            return null;
        }
    }

    get databaseProvider(): DatabaseProvider | null {
        if (this._modules["database-provider"]) {
            console.warn("Database provider is running");
            return this._modules["database-provider"];
        } else {
            console.warn("Database provider not up yet!")
            return null;
        }
    }

    async updateConfig(newConfig: any, moduleName?: string): Promise<any> {
        const databaseProvider = await this.databaseProvider;
        if (isNil(databaseProvider)) {
            return this.updateConfig(newConfig, moduleName);
        }
        const dbConfig = await databaseProvider.findOne('Config', {});
        if (isNil(dbConfig)) {
            throw new Error('Config not set');
        }
        const appConfig = (this as any).config as ConvictConfig<any>;
        let currentConfig: any;
        if (isNil(moduleName)) {
            currentConfig = dbConfig;
        } else {
            currentConfig = dbConfig[moduleName];
        }

        if (isNil(currentConfig)) currentConfig = {};
        const final = merge(currentConfig, newConfig);
        if (isNil(moduleName)){
            Object.assign(dbConfig, final);
        } else {
            if (isNil(dbConfig[moduleName])) dbConfig[moduleName] = {};
            Object.assign(dbConfig[moduleName], final);
        }
        const saved = await databaseProvider.findByIdAndUpdate('Config', dbConfig) as any;
        delete saved._id;
        delete saved.createdAt;
        delete saved.updatedAt;
        delete saved.__v;
        appConfig.load(saved);

        if (isNil(moduleName)) {
            return saved;
        } else {
            return saved[moduleName];
        }
    }

    // this validator doesn't support custom convict types
    static validateConfig(configInput: any, configSchema: any): Boolean {
        if (isNil(configInput)) return false;

        return Object.keys(configInput).every(key => {
            if (configSchema.hasOwnProperty(key)) {
                if (isPlainObject(configInput[key])) {
                    return this.validateConfig(configInput[key], configSchema[key])
                } else if (configSchema[key].hasOwnProperty('format')) {

                    const format = configSchema[key].format.toLowerCase();
                    if (typeof configInput[key] === format || format === '*') return true;
                    if (format === 'int' && validator.isInt(configInput[key])) return true;
                    if (format === 'port' && validator.isPort(configInput[key])) return true;
                    if (format === 'url' && validator.isURL(configInput[key])) return true;
                    if (format === 'email' && validator.isEmail(configInput[key])) return true;
                    if (format === 'ipaddress' && validator.isIP(configInput[key])) return true;
                    if (format === 'timestamp' && ((new Date(configInput[key])).getTime() > 0)) return true;
                    if (format === 'nat' && isNaturalNumber(configInput[key])) return true;
                    if (format === 'duration' && isNaturalNumber(configInput[key])) return true;
                }
            }
            return false;
        });
    }


}
export let grpcModule: any = grpc;
