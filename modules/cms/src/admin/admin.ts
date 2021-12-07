import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  RouteOptionType,
  ConduitString,
  ConduitNumber,
  ConduitBoolean,
  ConduitJson,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { SchemaController } from '../controllers/cms/schema.controller';
import { CustomEndpointController } from '../controllers/customEndpoints/customEndpoint.controller';
import { SchemaAdmin } from './schema.admin';
import { DocumentsAdmin } from './documents.admin';
import { CustomEndpointsAdmin } from './customEndpoints/customEndpoints.admin';
import { SchemaDefinitions, CustomEndpoints } from '../models';

export class AdminHandlers {
  private readonly schemaAdmin: SchemaAdmin;
  private readonly documentsAdmin: DocumentsAdmin;
  private readonly customEndpointsAdmin: CustomEndpointsAdmin;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly schemaController: SchemaController,
    private readonly customEndpointController: CustomEndpointController
  ) {
    this.schemaAdmin = new SchemaAdmin(
      this.grpcSdk,
      this.schemaController,
      this.customEndpointController
    );
    this.documentsAdmin = new DocumentsAdmin(this.grpcSdk);
    this.customEndpointsAdmin = new CustomEndpointsAdmin(
      this.grpcSdk,
      this.customEndpointController
    );
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        // Schemas
        getSchema: this.schemaAdmin.getSchema.bind(this.schemaAdmin),
        getSchemas: this.schemaAdmin.getSchemas.bind(this.schemaAdmin),
        getSchemasRegisteredByOtherModules: this.schemaAdmin.getSchemasRegisteredByOtherModules.bind(this.schemaAdmin),
        createSchema: this.schemaAdmin.createSchema.bind(this.schemaAdmin),
        editSchema: this.schemaAdmin.editSchema.bind(this.schemaAdmin),
        deleteSchema: this.schemaAdmin.deleteSchema.bind(this.schemaAdmin),
        deleteSchemas: this.schemaAdmin.deleteSchemas.bind(this.schemaAdmin),
        toggleSchema: this.schemaAdmin.toggleSchema.bind(this.schemaAdmin),
        toggleSchemas: this.schemaAdmin.toggleSchemas.bind(this.schemaAdmin),
        // Documents
        getDocument: this.documentsAdmin.getDocument.bind(this.documentsAdmin),
        getDocuments: this.documentsAdmin.getDocuments.bind(this.documentsAdmin),
        createDocument: this.documentsAdmin.createDocument.bind(this.documentsAdmin),
        createDocuments: this.documentsAdmin.createDocuments.bind(this.documentsAdmin),
        editDocument: this.documentsAdmin.editDocument.bind(this.documentsAdmin),
        editDocuments: this.documentsAdmin.editDocuments.bind(this.documentsAdmin),
        deleteDocument: this.documentsAdmin.deleteDocument.bind(this.documentsAdmin),
        // Custom Endpoints
        getCustomEndpoints: this.customEndpointsAdmin.getCustomEndpoints.bind(this.customEndpointsAdmin),
        createCustomEndpoint: this.customEndpointsAdmin.createCustomEndpoint.bind(this.customEndpointsAdmin),
        editCustomEndpoint: this.customEndpointsAdmin.editCustomEndpoint.bind(this.customEndpointsAdmin),
        deleteCustomEndpoints: this.customEndpointsAdmin.deleteCustomEndpoints.bind(this.customEndpointsAdmin),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  private getRegisteredRoutes(): any[] {
    return [
      // Schemas
      constructConduitRoute(
        {
          path: '/schemas/:id',
          action: ConduitRouteActions.GET,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('GetSchema', SchemaDefinitions.getInstance().fields),
        'getSchema'
      ),
      constructConduitRoute(
        {
          path: '/schemas',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            search: ConduitString.Optional,
            sort: ConduitString.Optional,
            enabled: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetSchemas', {
          results: { // TODO: unnest (frontend compat)
            schemas: [SchemaDefinitions.getInstance().fields],
            documentsCount: ConduitNumber.Required,
          }
        }),
        'getSchemas'
      ),
      constructConduitRoute(
        {
          path: '/schemasFromOtherModules',
          action: ConduitRouteActions.GET,
        },
        new ConduitRouteReturnDefinition('GetSchemasFromOtherModules', {
          results: [TYPE.JSON], // Swagger parser inconsistency // TODO: rename to externalSchemas (frontend compat)
        }),
        'getSchemasFromOtherModules'
      ),
      constructConduitRoute(
        {
          path: '/schemas',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
            fields: ConduitJson.Required,
            modelOptions: ConduitJson.Optional,
            enabled: ConduitBoolean.Optional,
            authentication: ConduitBoolean.Optional,
            crudOperations: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition('CreateSchema', SchemaDefinitions.getInstance().fields),
        'createSchema'
      ),
      constructConduitRoute(
        {
          path: '/schemas/:id',
          action: ConduitRouteActions.PATCH,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            name: ConduitString.Optional,
            fields: ConduitJson.Optional,
            modelOptions: ConduitJson.Optional,
            enabled: ConduitBoolean.Optional,
            authentication: ConduitBoolean.Optional,
            crudOperations: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition('EditSchema', SchemaDefinitions.getInstance().fields),
        'editSchema'
      ),
      constructConduitRoute(
        {
          path: '/schemas/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            deleteData: ConduitBoolean.Required,
          },
        },
        new ConduitRouteReturnDefinition('DeleteSchema', { // could be 'String' (frontend compat)
          message: ConduitString.Required,
        }),
        'deleteSchema'
      ),
      constructConduitRoute(
        {
          path: '/schemas',
          action: ConduitRouteActions.DELETE,
          bodyParams: {
            ids: { type: [TYPE.JSON], required: true }, // handler array check is still required
          },
        },
        new ConduitRouteReturnDefinition('DeleteSchemas', 'String'),
        'deleteSchemas'
      ),
      constructConduitRoute(
        {
          path: '/schemas/toggle/:id',
          action: ConduitRouteActions.UPDATE,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('ToggleSchema', {
          name: ConduitString.Required,
          enabled: ConduitBoolean.Required,
        }),
        'toggleSchema'
      ),
      constructConduitRoute(
        {
          path: '/schemas/toggle',
          action: ConduitRouteActions.UPDATE,
          bodyParams: {
            ids: { type: [TYPE.JSON], required: true }, // handler array check is still required
            enabled: ConduitBoolean.Required,
          }
        },
        new ConduitRouteReturnDefinition('ToggleSchemas', {
          updatedSchemas: [SchemaDefinitions.getInstance().fields],
          enabled: ConduitBoolean.Required,
        }),
        'toggleSchemas'
      ),
      // Documents
      constructConduitRoute(
        {
          path: '/content/:schemaName/:id',
          action: ConduitRouteActions.GET,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('GetDocument', TYPE.JSON),
        'getDocument'
      ),
      constructConduitRoute(
        {
          path: '/query/:schemaName',
          action: ConduitRouteActions.POST,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
          },
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
          },
          bodyParams: {
            query: ConduitJson.Required,
          }
        },
        new ConduitRouteReturnDefinition('GetDocuments', {
          documents: [TYPE.JSON], // Swagger parser inconsistency
          documentsCount: TYPE.Number,
        }),
        'getDocuments'
      ),
      constructConduitRoute(
        {
          path: '/content/:schemaName',
          action: ConduitRouteActions.POST,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            inputDocument: ConduitJson.Required,
          },
        },
        new ConduitRouteReturnDefinition('CreateDocument', TYPE.JSON),
        'createDocument'
      ),
      constructConduitRoute(
        {
          path: '/content/:schemaName/many',
          action: ConduitRouteActions.POST,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            inputDocuments: { type: [TYPE.JSON], required: true },
          },
        },
        new ConduitRouteReturnDefinition('CreateDocuments', {
          newDocuments: [TYPE.JSON], // Swagger parser inconsistency
        }),
        'createDocuments'
      ),
      constructConduitRoute(
        {
          path: '/schemas/:schemaName/:id',
          action: ConduitRouteActions.UPDATE,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            changedDocument: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('EditDocument', TYPE.JSON),
        'editDocument'
      ),
      constructConduitRoute(
        {
          path: '/schemas/:schemaName/many',
          action: ConduitRouteActions.UPDATE,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            changedDocuments: { type: [TYPE.JSON], required: true },
          },
        },
        new ConduitRouteReturnDefinition('EditDocuments', {
          docs: [TYPE.JSON], // Swagger parser inconsistency
        }),
        'editDocuments'
      ),
      constructConduitRoute(
        {
          path: '/schemas/:schemaName/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('DeleteDocument', 'String'),
        'deleteDocument'
      ),
      // Custom Endpoints
      constructConduitRoute(
        {
          path: '/customEndpoints',
          action: ConduitRouteActions.GET,
          queryParams: {
            search: ConduitString.Optional,
            operation: ConduitString.Optional,
          }
        },
        new ConduitRouteReturnDefinition('GetCustomEndpoints', {
          customEndpoints: [CustomEndpoints.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'getCustomEndpoints'
      ),
      constructConduitRoute(
        {
          path: '/customEndpoints',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
            operation: ConduitNumber.Required,
            selectedSchema: ConduitString.Optional,
            selectedSchemaName: ConduitString.Optional,
            query: ConduitJson.Optional,
            inputs: { type: [TYPE.JSON], required: false },
            assignments: { type: [TYPE.JSON], required: false },
            authentication: ConduitBoolean.Optional,
            sorted: ConduitBoolean.Optional,
            paginated: ConduitBoolean.Optional,
          }
        },
        new ConduitRouteReturnDefinition('CreateCustomEndpoint', CustomEndpoints.getInstance().fields),
        'createCustomEndpoint'
      ),
      constructConduitRoute(
        {
          path: '/customEndpoints/:id',
          action: ConduitRouteActions.PATCH,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            selectedSchema: ConduitString.Optional,
            selectedSchemaName: ConduitString.Optional,
            query: ConduitJson.Optional,
            inputs: { type: [TYPE.JSON], required: false },
            assignments: { type: [TYPE.JSON], required: false },
            // authentication: ConduitBoolean.Optional, // TODO: Support modifying auth
            sorted: ConduitBoolean.Optional,
            paginated: ConduitBoolean.Optional,
          }
        },
        new ConduitRouteReturnDefinition('EditCustomEndpoint', CustomEndpoints.getInstance().fields),
        'editCustomEndpoint'
      ),
      constructConduitRoute(
        {
          path: '/customEndpoints/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('deleteCustomEndpoints', 'String'),
        'deleteCustomEndpoints'
      ),
    ];
  }
}
