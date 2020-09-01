import ConduitGrpcSdk, {
    ConduitRoute,
    ConduitRouteActions,
    ConduitRouteReturnDefinition,
    constructRoute,
    TYPE
} from '@quintessential-sft/conduit-grpc-sdk';
import {CmsHandlers} from '../handlers/CmsHandlers';
import grpc from 'grpc';
import fs from "fs";
import path from "path";

var protoLoader = require('@grpc/proto-loader');
var PROTO_PATH = __dirname + '/router.proto';

export class CmsRoutes {
    private readonly handlers: CmsHandlers;

    constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk, private readonly url: string) {
        this.handlers = new CmsHandlers(grpcSdk);

        const packageDefinition = protoLoader.loadSync(
            PROTO_PATH,
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        // @ts-ignore
        const router = protoDescriptor.cms.router.Router;
        server.addService(router.service, {
            getDocuments: this.handlers.getDocuments.bind(this.handlers),
            getDocumentById: this.handlers.getDocumentById.bind(this.handlers),
            createDocument: this.handlers.createDocument.bind(this.handlers),
            editDocument: this.handlers.editDocument.bind(this.handlers),
            deleteDocument: this.handlers.deleteDocument.bind(this.handlers)
        });
    }

    refreshRoutes(schemas: { [name: string]: any }) {
        let schemaCopy = Object.assign({}, schemas);
        delete schemaCopy['SchemaDefinitions'];
        if (Object.keys(schemaCopy).length === 0) {
            return;
        }
        let routesProtoFile = fs.readFileSync(path.resolve(__dirname, './router.proto'));
        this.grpcSdk.router.register(this.registeredRoutes(schemaCopy), routesProtoFile.toString('utf-8'), this.url)
            .catch((err: Error) => {
                console.log("Failed to register routes for CMS module!")
                console.error(err);
            });
    }

    compareFunction(schemaA: any, schemaB: any): number {
        let hasA = [];
        let hasB = [];
        for (const k in schemaA.modelSchema) {
            if (schemaA.modelSchema[k].ref) {
                hasA.push(schemaA.modelSchema[k].ref);
            }
        }
        for (const k in schemaB.modelSchema) {
            if (schemaB.modelSchema[k].ref) {
                hasB.push(schemaB.modelSchema[k].ref);
            }
        }

        if (hasA.length === 0 && hasB.length === 0) {
            return 0;
        } else if (hasA.length === 0 && hasB.length !== 0) {
            if (hasB.indexOf(schemaA.name)) {
                return 1;
            } else {
                return -1;
            }
        } else if (hasA.length !== 0 && hasB.length === 0) {
            if (hasA.indexOf(schemaB.name)) {
                return -1;
            } else {
                return 1;
            }
        } else {
            if (hasA.indexOf(schemaB.name) && hasB.indexOf(schemaA.name)) {
                return 0;
            } else if (hasA.indexOf(schemaB.name)) {
                return -1;
            } else if (hasB.indexOf(schemaA.name)) {
                return 1;
            }else{
                return 0;
            }
        }
    }


    registeredRoutes(schemas: { [name: string]: any }): any[] {
        let routesArray: any[] = [];
        let schemaSort = [];
        for (const k in schemas) {
            schemaSort.push(k);
        }
        schemaSort.sort((a: string, b: string) => {
            return this.compareFunction(schemas[a], schemas[b]);
        })
        schemaSort.forEach(r=>{
            routesArray = routesArray.concat(this.getOps(r, schemas[r]));
        })
        return routesArray;
    }

    getOps(schemaName: string, actualSchema: any) {
        let routesArray: any = [];

        routesArray.push(constructRoute(new ConduitRoute({
                path: `/content/${schemaName}`,
                action: ConduitRouteActions.GET,
                queryParams: {
                    skip: TYPE.Number,
                    limit: TYPE.Number
                }
            }, new ConduitRouteReturnDefinition(`get${schemaName}`, {
                result: {
                    documents: [actualSchema.modelSchema],
                    documentsCount: TYPE.Number
                }
            }),
            'getDocuments'
        )));

        routesArray.push(constructRoute(new ConduitRoute({
                path: `/content/${schemaName}/:id`,
                action: ConduitRouteActions.GET,
                urlParams: {
                    id: TYPE.String
                }
            }, new ConduitRouteReturnDefinition(`get${schemaName}ById`, actualSchema.modelSchema),
            'getDocumentById')));

        routesArray.push(constructRoute(new ConduitRoute({
                path: `/content/${schemaName}`,
                action: ConduitRouteActions.POST,
                bodyParams: actualSchema.modelSchema
            }, new ConduitRouteReturnDefinition(`create${schemaName}`, actualSchema.modelSchema),
            'createDocument')));

        routesArray.push(constructRoute(new ConduitRoute({
                path: `/content/${schemaName}/:id`,
                action: ConduitRouteActions.UPDATE,
                urlParams: {
                    id: TYPE.String,
                },
                bodyParams: actualSchema.modelSchema
            }, new ConduitRouteReturnDefinition(`update${schemaName}`, actualSchema.modelSchema),
            'editDocument')));

        routesArray.push(constructRoute(new ConduitRoute({
                path: `/content/${schemaName}/:id`,
                action: ConduitRouteActions.DELETE,
                urlParams: {
                    id: TYPE.String
                }
            }, new ConduitRouteReturnDefinition(`delete${schemaName}`, {result: TYPE.String}),
            'deleteDocument')));

        return routesArray;
    }
}
