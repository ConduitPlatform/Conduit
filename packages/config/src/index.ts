import * as grpc from "grpc";
import {ConfigService} from "@conduit/grpc-sdk/dist/generated/core_grpc_pb";

export default class ConfigManager {

    databaseCallback: any;
    registeredModules: Map<string, string> = new Map<string, string>();

    constructor(server: grpc.Server, databaseCallback: any) {
        server.addService(ConfigService, {
            get: this.get,
            updateConfig: this.updateConfig,
            moduleExists: this.moduleExists,
            registerModule: this.registerModule,
        })
        this.databaseCallback = databaseCallback;
    }

    get(call: any, callback: any) {
        // todo implement
    }

    updateConfig(call: any, callback: any) {
        // todo implement
    }

    moduleExists(call: any, callback: any) {
        // todo implement
    }

    registerModule(call: any, callback: any) {
        // todo implement
        this.registeredModules.set(call.request.moduleName, call.request.url);
        if (call.request.moduleName === 'database') {
            this.databaseCallback();
        }
    }


}
