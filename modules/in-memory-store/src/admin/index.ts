import * as grpc from "grpc";
import {isNil} from "lodash";
import {StorageProvider} from "../interaces/StorageProvider";

var protoLoader = require('@grpc/proto-loader');
var PROTO_PATH = __dirname + '/admin.proto';

export class AdminHandler {

    private _provider: StorageProvider | null = null;

    constructor(server: grpc.Server, provider: StorageProvider | null = null) {
        this._provider = provider;
        var packageDefinition = protoLoader.loadSync(
            PROTO_PATH,
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        // The protoDescriptor object has the full package hierarchy
        // @ts-ignore
        var admin = protoDescriptor.inmemorystore.admin.Admin;
        server.addService(admin.service, {
            get: this.get.bind(this),
            store: this.store.bind(this)
        });
    }

    updateProvider(provider: StorageProvider | null) {
        this._provider = provider;
    }

    get(call: any, callback: any) {
        const key = JSON.parse(call.request.params).key;
        if (isNil(key)) {
            callback({
                code: grpc.status.NOT_FOUND,
                message: "Key is missing",
            });
        }

        this._provider?.get(key)
            .then(r => {
                callback(null, {result: JSON.stringify({value: r})});
            })
            .catch(err => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
                });
            });

    }

    store(call: any, callback: any) {
        const {key, value} = JSON.parse(call.request.params);
        if (isNil(key) || isNil(value)) {
            callback({
                code: grpc.status.NOT_FOUND,
                message: "Required fields are missing",
            });
        }

        this._provider?.store(key, value)
            .then(r => {
                callback(null, {result: JSON.stringify({result: true})});
            })
            .catch(err => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
                });
            });
    }
}
