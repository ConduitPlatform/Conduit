import Config from "./config";
import Admin from "./admin";
import Router from "./router";
import * as grpc from "grpc";
import InMemoryStore from "./inMemoryStore";


export default class ConduitGrpcSdk {

    private readonly serverUrl: string;
    private readonly _config: Config;
    private readonly _admin: Admin;
    private readonly _router: Router;
    private readonly _modules: any = {};
    private readonly _availableModules: any = {
        "in-memory-store": InMemoryStore
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
        this._config
            .moduleList()
            .then(r => {
                this.lastSearch = Date.now();
                r.forEach(m => {
                    if (!this._modules[m.moduleName] && this._availableModules[m.moduleName]) {
                        this._modules[m.moduleName] = new this._availableModules[m.moduleName](m.url);
                    }
                })
            })
            .catch(err => {
                console.error(err);
            })
    }

    /**
     * Used to refresh all modules to check for new registrations
     * @param force If true will check for new modules no matter the interval
     */
    refreshModules(force?: boolean) {
        if (this.lastSearch < (Date.now() - 3000) || force) {
            this.initializeModules();
        }
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
        if (this._modules['in-memory-store']) {
            return this._modules['in-memory-store'];
        } else {
            console.warn("In memory store not up yet!")
            return null;
        }
    }


}
export let grpcModule: any = grpc;
