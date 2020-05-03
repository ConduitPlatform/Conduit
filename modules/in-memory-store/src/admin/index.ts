import * as grpc from "grpc";
import {NextFunction, Request, Response} from "express";
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
        var admin = protoDescriptor.inmemorystore.admin;
        server.addService(admin.InMemoryStoreAdmin.service, {
            get: this.get.bind(this),
            store: this.store.bind(this)
        });
    }

    updateProvider(provider: StorageProvider | null) {
        this._provider = provider;
    }

    get(call: any, callback: any) {
        const key = call.request.key;
        if (isNil(key)) {
            callback(new Error('Required parameter "key" is missing'), null);
        }

        this._provider?.get(key)
            .then(r => {
                callback(null, {value: r});
            })
            .catch(err => {
                callback(new Error('Something went wrong'), null);

            });

    }

    store(call: any, callback: any) {
        const {key, value} = call.request;
        if (isNil(key) || isNil(value)) {
            callback(new Error('Required fields are missing'), null);
        }

        this._provider?.store(key, value)
            .then(r => {
                callback(null, {result: true});
            })
            .catch(err => {
                callback(new Error('Something went wrong'), null);
            });
    }
}
