import * as grpc from "grpc";


export default class ConfigManager {

    databaseCallback: any;
    registeredModules: Map<string, string> = new Map<string, string>();

    constructor(server: grpc.Server, packageDefinition: any, databaseCallback: any) {
        var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

        // @ts-ignore
        var config = protoDescriptor.conduit.core.Config;
        server.addService(config.service, {
            get: this.get.bind(this),
            updateConfig: this.updateConfig.bind(this),
            moduleExists: this.moduleExists.bind(this),
            registerModule: this.registerModule.bind(this),
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
        if (this.registeredModules.has(call.moduleName)) {
            callback(null, this.registeredModules.get(call.moduleName));
        } else {
            callback(new Error("Module does not exist"));
        }
    }

    registerModule(call: any, callback: any) {
        // todo implement
        this.registeredModules.set(call.request.moduleName, call.request.url);
        if (call.request.moduleName === 'database') {
            this.databaseCallback();
        }
        callback(null, {result: true});
    }


}
