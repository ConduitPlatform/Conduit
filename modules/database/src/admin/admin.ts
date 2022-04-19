import ConduitGrpcSdk, {
  ConduitBoolean,
  ConduitJson,
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  constructConduitRoute,
  GrpcServer,
  RouteOptionType,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { CustomEndpointsAdmin } from './customEndpoints/customEndpoints.admin';
import { DocumentsAdmin } from './documents.admin';
import { SchemaAdmin } from './schema.admin';
import { SchemaController } from '../controllers/cms/schema.controller';
import { CustomEndpointController } from '../controllers/customEndpoints/customEndpoint.controller';
import { DeclaredSchema, CustomEndpoints } from '../models';

export class AdminHandlers {
  private readonly schemaAdmin: SchemaAdmin;
  private readonly documentsAdmin: DocumentsAdmin;
  private readonly customEndpointsAdmin: CustomEndpointsAdmin;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly _activeAdapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
    private readonly schemaController: SchemaController,
    private readonly customEndpointController: CustomEndpointController,
  ) {
    this.schemaAdmin = new SchemaAdmin(
      this.grpcSdk,
      this._activeAdapter,
      this.schemaController,
      this.customEndpointController,
    );
    this.documentsAdmin = new DocumentsAdmin(this.grpcSdk, _activeAdapter);
    this.customEndpointsAdmin = new CustomEndpointsAdmin(
      this.grpcSdk,
      this._activeAdapter,
      this.customEndpointController,
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
        getSchemasExtensions: this.schemaAdmin.getSchemasExtensions.bind(this.schemaAdmin),
        createSchema: this.schemaAdmin.createSchema.bind(this.schemaAdmin),
        patchSchema: this.schemaAdmin.patchSchema.bind(this.schemaAdmin),
        deleteSchema: this.schemaAdmin.deleteSchema.bind(this.schemaAdmin),
        deleteSchemas: this.schemaAdmin.deleteSchemas.bind(this.schemaAdmin),
        toggleSchema: this.schemaAdmin.toggleSchema.bind(this.schemaAdmin),
        toggleSchemas: this.schemaAdmin.toggleSchemas.bind(this.schemaAdmin),
        setSchemaExtension: this.schemaAdmin.setSchemaExtension.bind(this.schemaAdmin),
        setSchemaPerms: this.schemaAdmin.setSchemaPerms.bind(this.schemaAdmin),
        getSchemaOwners: this.schemaAdmin.getSchemaOwners.bind(this.schemaAdmin),
        introspectDatabase: this.schemaAdmin.introspectDatabase.bind(this.schemaAdmin),
        getPendingSchemas: this.schemaAdmin.getPendingSchemas.bind(this.schemaAdmin),
        finalizeSchemas: this.schemaAdmin.finalizeSchemas.bind(this.schemaAdmin),
        // Documents
        getDocument: this.documentsAdmin.getDocument.bind(this.documentsAdmin),
        getDocuments: this.documentsAdmin.getDocuments.bind(this.documentsAdmin),
        createDocument: this.documentsAdmin.createDocument.bind(this.documentsAdmin),
        createDocuments: this.documentsAdmin.createDocuments.bind(this.documentsAdmin),
        updateDocument: this.documentsAdmin.updateDocument.bind(this.documentsAdmin),
        updateDocuments: this.documentsAdmin.updateDocuments.bind(this.documentsAdmin),
        deleteDocument: this.documentsAdmin.deleteDocument.bind(this.documentsAdmin),
        // Custom Endpoints
        getCustomEndpoints: this.customEndpointsAdmin.getCustomEndpoints.bind(this.customEndpointsAdmin),
        createCustomEndpoint: this.customEndpointsAdmin.createCustomEndpoint.bind(this.customEndpointsAdmin),
        patchCustomEndpoint: this.customEndpointsAdmin.patchCustomEndpoint.bind(this.customEndpointsAdmin),
        deleteCustomEndpoint: this.customEndpointsAdmin.deleteCustomEndpoint.bind(this.customEndpointsAdmin),
        getSchemasWithCustomEndpoints: this.customEndpointsAdmin.getSchemasWithCustomEndpoints.bind(this.customEndpointsAdmin)
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
          path: '/schemas/owners',
          action: ConduitRouteActions.GET,
        },
        new ConduitRouteReturnDefinition('GetSchemaOwners', {
          modules: [ConduitString.Required],
        }),
        'getSchemaOwners',
      ),
      constructConduitRoute(
        {
          path: '/schemas/extensions',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetSchemasExtensions', {
          schemasExtensions: [ConduitJson.Required],
          count: ConduitNumber.Required,
        }),
        'getSchemasExtensions',
      ),
      constructConduitRoute(
        {
          path: '/schemas/:id',
          action: ConduitRouteActions.GET,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('GetSchema', DeclaredSchema.fields),
        'getSchema',
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
            owner: [ConduitString.Optional],
          },
        },
        new ConduitRouteReturnDefinition('GetSchemas', {
          schemas: [DeclaredSchema.fields],
          count: ConduitNumber.Required,
        }),
        'getSchemas',
      ),
      constructConduitRoute(
        {
          path: '/schemas',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
            fields: ConduitJson.Required,
            modelOptions: ConduitJson.Optional,
            enabled: ConduitBoolean.Optional, // move inside modelOptions (frontend-compat)
            authentication: ConduitBoolean.Optional, // move inside modelOptions (frontend-compat)
            crudOperations: ConduitBoolean.Optional, // move inside modelOptions (frontend-compat)
            permissions: {
              extendable: ConduitBoolean.Optional,
              canCreate: ConduitBoolean.Optional,
              canModify: ConduitString.Optional,
              canDelete: ConduitBoolean.Optional,
            },
          },
        },
        new ConduitRouteReturnDefinition('CreateSchema', DeclaredSchema.fields),
        'createSchema',
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
            enabled: ConduitBoolean.Optional, // move inside modelOptions (frontend-compat)
            authentication: ConduitBoolean.Optional, // move inside modelOptions (frontend-compat)
            crudOperations: ConduitBoolean.Optional, // move inside modelOptions (frontend-compat)
            permissions: {
              extendable: ConduitBoolean.Optional,
              canCreate: ConduitBoolean.Optional,
              canModify: ConduitString.Optional,
              canDelete: ConduitBoolean.Optional,
            },
          },
        },
        new ConduitRouteReturnDefinition('PatchSchema', DeclaredSchema.fields),
        'patchSchema',
      ),
      constructConduitRoute(
        {
          path: '/schemas',
          action: ConduitRouteActions.DELETE,
          queryParams: {
            ids: { type: [TYPE.JSON], required: true }, // handler array check is still required
          },
        },
        new ConduitRouteReturnDefinition('DeleteSchemas', 'String'),
        'deleteSchemas',
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
        new ConduitRouteReturnDefinition('DeleteSchema', 'String'),
        'deleteSchema',
      ),
      constructConduitRoute(
        {
          path: '/schemas/toggle',
          action: ConduitRouteActions.POST,
          bodyParams: {
            ids: { type: [TYPE.JSON], required: true }, // handler array check is still required
            enabled: ConduitBoolean.Required,
          },
        },
        new ConduitRouteReturnDefinition('ToggleSchemas', {
          updatedSchemas: [DeclaredSchema.fields],
          enabled: ConduitBoolean.Required,
        }),
        'toggleSchemas',
      ),
      constructConduitRoute(
        {
          path: '/schemas/:id/toggle',
          action: ConduitRouteActions.POST,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('ToggleSchema', {
          name: ConduitString.Required,
          enabled: ConduitBoolean.Required,
        }),
        'toggleSchema',
      ),
      constructConduitRoute(
        {
          path: '/schemas/:schemaId/extensions',
          action: ConduitRouteActions.POST,
          urlParams: {
            schemaId: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            fields: ConduitJson.Required,
          },
        },
        new ConduitRouteReturnDefinition('SetSchemaExtension', DeclaredSchema.fields),
        'setSchemaExtension',
      ),
      constructConduitRoute(
        {
          path: '/schemas/:id/permissions',
          action: ConduitRouteActions.PATCH,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            extendable: ConduitBoolean.Optional,
            canCreate: ConduitBoolean.Optional,
            canModify: ConduitString.Optional,
            canDelete: ConduitBoolean.Optional,
          },
        },
        new ConduitRouteReturnDefinition('SetSchemaPermissions', 'String'),
        'setSchemaPerms',
      ),
      constructConduitRoute({
        path: '/introspection',
        action: ConduitRouteActions.POST,
      },
      new ConduitRouteReturnDefinition('IntrospectDatabase', TYPE.JSON),
      'introspectDatabase'
      ),
      constructConduitRoute({
        path: '/introspection/schemas',
        action: ConduitRouteActions.GET,
      },
      new ConduitRouteReturnDefinition('GetPendingSchemas',TYPE.JSON),
      'getPendingSchemas'
      ),
      constructConduitRoute({
        path: '/introspection/schemas/finalize',
        action: ConduitRouteActions.POST,
      },
      new ConduitRouteReturnDefinition('FinalizeSchemas',TYPE.String),
      'finalizeSchemas'
      ),
      // Documents
      constructConduitRoute(
        {
          path: '/schemas/:schemaName/docs/:id',
          action: ConduitRouteActions.GET,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('GetDocument', TYPE.JSON),
        'getDocument',
      ),
      constructConduitRoute(
        {
          path: '/schemas/:schemaName/query',
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
          },
        },
        new ConduitRouteReturnDefinition('GetDocuments', {
          documents: ConduitJson.Required,
          count: ConduitNumber.Required,
        }),
        'getDocuments',
      ),
      constructConduitRoute(
        {
          path: '/schemas/:schemaName/docs',
          action: ConduitRouteActions.POST,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            inputDocument: ConduitJson.Required,
          },
        },
        new ConduitRouteReturnDefinition('CreateDocument', TYPE.JSON),
        'createDocument',
      ),
      constructConduitRoute(
        {
          path: '/schemas/:schemaName/docs/many',
          action: ConduitRouteActions.POST,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            inputDocuments: { type: [TYPE.JSON], required: true },
          },
        },
        new ConduitRouteReturnDefinition('CreateDocuments', {
          docs: [ConduitJson.Required],
        }),
        'createDocuments',
      ),
      constructConduitRoute(
        {
          path: '/schemas/:schemaName/docs',
          action: ConduitRouteActions.UPDATE,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            changedDocuments: { type: [TYPE.JSON], required: true },
          },
        },
        new ConduitRouteReturnDefinition('UpdateDocuments', {
          docs: [ConduitJson.Required],
        }),
        'updateDocuments',
      ),
      constructConduitRoute(
        {
          path: '/schemas/:schemaName/docs/:id',
          action: ConduitRouteActions.UPDATE,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            changedDocument: ConduitJson.Required,
          },
        },
        new ConduitRouteReturnDefinition('UpdateDocument', TYPE.JSON),
        'UpdateDocument',
      ),
      constructConduitRoute(
        {
          path: '/schemas/:schemaName/docs/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            schemaName: { type: RouteOptionType.String, required: true },
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('DeleteDocument', 'String'),
        'deleteDocument',
      ),
      // Custom Endpoints
      constructConduitRoute(
        {
          path: '/customEndpoints/schemas',
          action: ConduitRouteActions.GET,
        },
        new ConduitRouteReturnDefinition('GetSchemasWithCustomEndpoints', {
          schemaNames: [ConduitString.Required],
          schemaIds: [ConduitNumber.Required],
        }),
        'getSchemasWithCustomEndpoints',
      ),
      constructConduitRoute(
        {
          path: '/customEndpoints',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            search: ConduitString.Optional,
            operation: ConduitString.Optional,
            schemaName: [ConduitString.Optional],
          },
        },
        new ConduitRouteReturnDefinition('GetCustomEndpoints', {
          customEndpoints: [CustomEndpoints.fields],
          count: ConduitNumber.Required,
        }),
        'getCustomEndpoints',
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
          },
        },
        new ConduitRouteReturnDefinition('CreateCustomEndpoint', CustomEndpoints.fields),
        'createCustomEndpoint',
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
          },
        },
        new ConduitRouteReturnDefinition('PatchCustomEndpoint', CustomEndpoints.fields),
        'patchCustomEndpoint',
      ),
      constructConduitRoute(
        {
          path: '/customEndpoints/:id',
          action: ConduitRouteActions.DELETE,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('deleteCustomEndpoint', 'String'),
        'deleteCustomEndpoint',
      ),
    ];
  }
}
