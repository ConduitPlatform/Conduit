import ConduitGrpcSdk, { GrpcServer } from '@quintessential-sft/conduit-grpc-sdk';
import { SchemaController } from '../controllers/cms/schema.controller';
import { SchemaAdmin } from './schema.admin';
import { DocumentsAdmin } from './documents.admin';
import { CustomEndpointsAdmin } from './customEndpoints/customEndpoints.admin';
import { CustomEndpointController } from '../controllers/customEndpoints/customEndpoint.controller';

let paths = require('./admin.json').functions;

export class AdminHandlers {

  constructor(
    server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly schemaController: SchemaController,
    private readonly customEndpointController: CustomEndpointController
  ) {
    // @ts-ignore
    let schemaAdmin = new SchemaAdmin(
      this.grpcSdk,
      this.schemaController,
      this.customEndpointController
    );
    let documentsAdmin = new DocumentsAdmin(this.grpcSdk);
    let customEndpointsAdmin = new CustomEndpointsAdmin(
      this.grpcSdk,
      this.customEndpointController
    );
    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        getAllSchemas: schemaAdmin.getAllSchemas.bind(schemaAdmin),
        getSchemasRegisteredByOtherModules: schemaAdmin.getSchemasRegisteredByOtherModules.bind(schemaAdmin),
        getById: schemaAdmin.getById.bind(schemaAdmin),
        createSchema: schemaAdmin.createSchema.bind(schemaAdmin),
        toggle: schemaAdmin.toggle.bind(schemaAdmin),
        toggleMany: schemaAdmin.toggleMany.bind(schemaAdmin),
        editSchema: schemaAdmin.editSchema.bind(schemaAdmin),
        deleteSchema: schemaAdmin.deleteSchema.bind(schemaAdmin),
        getDocuments: documentsAdmin.getDocuments.bind(documentsAdmin),
        getDocumentById: documentsAdmin.getDocumentById.bind(documentsAdmin),
        createDocument: documentsAdmin.createDocument.bind(documentsAdmin),
        createManyDocuments: documentsAdmin.createManyDocuments.bind(documentsAdmin),
        editDocument: documentsAdmin.editDocument.bind(documentsAdmin),
        editManyDocuments: documentsAdmin.editManyDocuments.bind(documentsAdmin),
        deleteDocument: documentsAdmin.deleteDocument.bind(documentsAdmin),
        deleteManySchemas: schemaAdmin.deleteManySchemas.bind(schemaAdmin),
        getCustomEndpoints: customEndpointsAdmin.getCustomEndpoints.bind(
          customEndpointsAdmin
        ),
        createCustomEndpoints: customEndpointsAdmin.createCustomEndpoints.bind(
          customEndpointsAdmin
        ),
        deleteCustomEndpoints: customEndpointsAdmin.deleteCustomEndpoints.bind(
          customEndpointsAdmin
        ),
        editCustomEndpoints: customEndpointsAdmin.editCustomEndpoints.bind(
          customEndpointsAdmin
        ),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }
}
