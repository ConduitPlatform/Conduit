import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import path from "path";
import grpc from "grpc";
import {SchemaController} from "../controllers/cms/schema.controller";
import {SchemaAdmin} from "./schema.admin";
import {DocumentsAdmin} from "./documents.admin";
import {CustomEndpointsAdmin} from "./customEndpoints/customEndpoints.admin";
import { CustomEndpointController } from '../controllers/customEndpoints/customEndpoint.controller';

const protoLoader = require('@grpc/proto-loader');

export class AdminHandlers {
    private database: any;

    constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk, private readonly schemaController: SchemaController, private readonly customEndpointController: CustomEndpointController) {

        this.database = this.grpcSdk.databaseProvider;
        let packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, './admin.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            }
        );
        let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
        // @ts-ignore
        let admin = protoDescriptor.cms.admin.Admin;
        let schemaAdmin = new SchemaAdmin(this.grpcSdk, this.schemaController, this.customEndpointController);
        let documentsAdmin = new DocumentsAdmin(this.grpcSdk, this.schemaController);
        let customEndpointsAdmin = new CustomEndpointsAdmin(this.grpcSdk, this.customEndpointController);
        server.addService(admin.service, {
            getAllSchemas: schemaAdmin.getAllSchemas.bind(schemaAdmin),
            getById: schemaAdmin.getById.bind(schemaAdmin),
            createSchema: schemaAdmin.createSchema.bind(schemaAdmin),
            toggle: schemaAdmin.toggle.bind(schemaAdmin),
            editSchema: schemaAdmin.editSchema.bind(schemaAdmin),
            deleteSchema: schemaAdmin.deleteSchema.bind(schemaAdmin),
            getDocuments: documentsAdmin.getDocuments.bind(documentsAdmin),
            getDocumentById: documentsAdmin.getDocumentById.bind(documentsAdmin),
            createDocument: documentsAdmin.createDocument.bind(documentsAdmin),
            createManyDocuments: documentsAdmin.createManyDocuments.bind(documentsAdmin),
            editDocument: documentsAdmin.editDocument.bind(documentsAdmin),
            editManyDocuments: documentsAdmin.editManyDocuments.bind(documentsAdmin),
            deleteDocument: documentsAdmin.deleteDocument.bind(documentsAdmin),
            getCustomEndpoints: customEndpointsAdmin.getCustomEndpoints.bind(customEndpointsAdmin),
            createCustomEndpoints: customEndpointsAdmin.createCustomEndpoints.bind(customEndpointsAdmin),
            deleteCustomEndpoints: customEndpointsAdmin.deleteCustomEndpoints.bind(customEndpointsAdmin),
            editCustomEndpoints: customEndpointsAdmin.editCustomEndpoints.bind(customEndpointsAdmin)

        });
    }


}
