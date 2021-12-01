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
        getManySchemas: this.schemaAdmin.getManySchemas.bind(this.schemaAdmin),
        getManySchemasRegisteredByOtherModules: this.schemaAdmin.getManySchemasRegisteredByOtherModules.bind(this.schemaAdmin),
        createSchema: this.schemaAdmin.createSchema.bind(this.schemaAdmin),
        editSchema: this.schemaAdmin.editSchema.bind(this.schemaAdmin),
        deleteSchema: this.schemaAdmin.deleteSchema.bind(this.schemaAdmin),
        deleteManySchemas: this.schemaAdmin.deleteManySchemas.bind(this.schemaAdmin),
        toggleSchema: this.schemaAdmin.toggleSchema.bind(this.schemaAdmin),
        toggleManySchemas: this.schemaAdmin.toggleManySchemas.bind(this.schemaAdmin),
        // Documents
        getDocument: this.documentsAdmin.getDocument.bind(this.documentsAdmin),
        getManyDocuments: this.documentsAdmin.getManyDocuments.bind(this.documentsAdmin),
        createDocument: this.documentsAdmin.createDocument.bind(this.documentsAdmin),
        createManyDocuments: this.documentsAdmin.createManyDocuments.bind(this.documentsAdmin),
        editDocument: this.documentsAdmin.editDocument.bind(this.documentsAdmin),
        editManyDocuments: this.documentsAdmin.editManyDocuments.bind(this.documentsAdmin),
        deleteDocument: this.documentsAdmin.deleteDocument.bind(this.documentsAdmin),
        // Custom Endpoints
        getManyCustomEndpoints: this.customEndpointsAdmin.getManyCustomEndpoints.bind(this.customEndpointsAdmin),
        createManyCustomEndpoints: this.customEndpointsAdmin.createManyCustomEndpoints.bind(this.customEndpointsAdmin),
        editCustomEndpoint: this.customEndpointsAdmin.editCustomEndpoint.bind(this.customEndpointsAdmin),
        deleteManyCustomEndpoints: this.customEndpointsAdmin.deleteManyCustomEndpoints.bind(this.customEndpointsAdmin),
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
        new ConduitRouteReturnDefinition('GetSchema', {
          requestedSchema: SchemaDefinitions.getInstance().fields,
        }),
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
            enabled: ConduitBoolean.Required,
          },
        },
        new ConduitRouteReturnDefinition('GetManySchemas', {
          results: { // TODO: unnest (frontend compat)
            schemas: SchemaDefinitions.getInstance().fields,
            documentsCount: ConduitNumber.Required,
          }
        }),
        'getManySchemas'
      ),
      constructConduitRoute(
        {
          path: '/schemasFromOtherModules',
          action: ConduitRouteActions.GET,
        },
        new ConduitRouteReturnDefinition('GetManySchemasFromOtherModules', {
          results: { // TODO: unnest (frontend compat)
            name: ConduitString.Required,
            fields: ConduitJson.Required,
          },
        }),
        'getManySchemasFromOtherModules'
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
        new ConduitRouteReturnDefinition('CreateSchema', {
          newSchema: SchemaDefinitions.getInstance().fields,
        }),
        'createSchema'
      ),
      constructConduitRoute(
        {
          path: '/schemas/:id',
          action: ConduitRouteActions.UPDATE, // works as PATCH (frontend compat)
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
        new ConduitRouteReturnDefinition('EditSchema', {
          updatedSchema: SchemaDefinitions.getInstance().fields,
        }),
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
        new ConduitRouteReturnDefinition('DeleteManySchemas', 'String'),
        'deleteManySchemas'
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
        new ConduitRouteReturnDefinition('ToggleManySchemas', {
          updatedSchemas: [SchemaDefinitions.getInstance().fields],
          enabled: ConduitBoolean.Required,
        }),
        'toggleManySchemas'
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
          queryParams: {
            populate: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetDocument', {
          document: ConduitJson.Required,
        }),
        'getDocument'
      ),
      constructConduitRoute(
        {
          path: '/content/:schemaName',
          action: ConduitRouteActions.GET,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
          },
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            search: ConduitString.Optional,
            query: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetManyDocuments', {
          documents: [TYPE.JSON], // Swagger parser inconsistency
          documentsCount: TYPE.Number,
        }),
        'getManyDocuments'
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
        new ConduitRouteReturnDefinition('CreateDocument', {
          newDocument: ConduitJson.Required,
        }),
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
        new ConduitRouteReturnDefinition('CreateManyDocuments', {
          newDocuments: [TYPE.JSON], // Swagger parser inconsistency
        }),
        'createManyDocuments'
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
        new ConduitRouteReturnDefinition('EditDocument', {
          updatedDocument: ConduitString.Required,
        }),
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
        new ConduitRouteReturnDefinition('EditManyDocuments', {
          docs: [TYPE.JSON], // Swagger parser inconsistency
        }),
        'editManyDocuments'
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
        new ConduitRouteReturnDefinition('GetManyCustomEndpoints', {
          results: { // TODO: unnest (frontend compat)
            customEndpointsDocs: [CustomEndpoints.getInstance().fields],
          }
        }),
        'getManyCustomEndpoints'
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
        new ConduitRouteReturnDefinition('CreateManyCustomEndpoints', {
          newSchema: CustomEndpoints.getInstance().fields,
        }),
        'CreateManyCustomEndpoints'
      ),
      constructConduitRoute(
        {
          path: '/customEndpoints/:id',
          action: ConduitRouteActions.UPDATE, // works as PATCH (frontend compat)
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
        new ConduitRouteReturnDefinition('EditCustomEndpoint', {
          updatedSchema: CustomEndpoints.getInstance().fields,
        }),
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
        new ConduitRouteReturnDefinition('deleteManyCustomEndpoints', 'String'),
        'deleteManyCustomEndpoints'
      ),
    ];
  }
}
