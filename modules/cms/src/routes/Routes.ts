import ConduitGrpcSdk, {
    ConduitRoute,
    ConduitRouteActions,
    ConduitRouteReturnDefinition,
    constructRoute,
    TYPE
} from '@conduit/grpc-sdk';
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
        let routesProtoFile = fs.readFileSync(path.resolve(__dirname, './router.proto'));
        this.grpcSdk.router.register(this.registeredRoutes(schemas), routesProtoFile.toString('UTF-8'), this.url)
            .catch((err: Error) => {
                console.log("Failed to register routes for CMS module!")
                console.error(err);
            });
    }

    registeredRoutes(schemas: { [name: string]: any }): any[] {
        let routesArray: any[] = [];
        for (const k in schemas) {
            if (!schemas.hasOwnProperty(k)) continue;
            routesArray = routesArray.concat(this.getOps(k, schemas[k]));
        }
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
                bodyParams: {
                    inputDocument: actualSchema
                }
            }, new ConduitRouteReturnDefinition(`create${schemaName}`, actualSchema.modelSchema),
            'createDocument')));

        routesArray.push(constructRoute(new ConduitRoute({
                path: `/content/${schemaName}/:id`,
                action: ConduitRouteActions.UPDATE,
                urlParams: {
                    id: TYPE.String,
                },
                bodyParams: {
                    changedDocument: actualSchema.modelSchema
                }
            }, new ConduitRouteReturnDefinition(`update${schemaName}`, actualSchema.modelSchema),
            'editDocument')));

        routesArray.push(constructRoute(new ConduitRoute({
                path: `/content/${schemaName}/:id`,
                action: ConduitRouteActions.DELETE,
                urlParams: {
                    id: TYPE.String
                }
            }, new ConduitRouteReturnDefinition('result', {result: TYPE.String}),
            'deleteDocument')));

        return routesArray;
    }
}
