import ConduitGrpcSdk, {
  ConduitBoolean,
  ConduitJson,
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcServer,
  RouteOptionType,
  RoutingManager,
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
import { CustomEndpoints, DeclaredSchema, PendingSchemas } from '../models';

export class AdminHandlers {
  private readonly schemaAdmin: SchemaAdmin;
  private readonly documentsAdmin: DocumentsAdmin;
  private readonly customEndpointsAdmin: CustomEndpointsAdmin;
  private readonly routingManager: RoutingManager;

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
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    this.routingManager.clear();
    // Schemas
    this.routingManager.route(
      {
        path: '/schemas/owners',
        action: ConduitRouteActions.GET,
        description: `Returns queried schema owner modules.`,
        queryParams: {
          sort: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetSchemaOwners', {
        modules: [ConduitString.Required],
      }),
      this.schemaAdmin.getSchemaOwners.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/extensions',
        action: ConduitRouteActions.GET,
        description: `Returns queried schema extensions and their total count.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetSchemasExtensions', {
        schemasExtensions: [ConduitJson.Required],
        count: ConduitNumber.Required,
      }),
      this.schemaAdmin.getSchemasExtensions.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/system',
        action: ConduitRouteActions.GET,
        description: `Returns Database-owned system schema names. Used for CMS operation validations.`,
      },
      new ConduitRouteReturnDefinition('GetDbSystemSchemas', {
        databaseSystemSchemas: [ConduitString.Required],
      }),
      this.schemaAdmin.getDbSystemSchemas.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:id',
        action: ConduitRouteActions.GET,
        description: `Returns a schema.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('GetSchema', '_DeclaredSchema'),
      this.schemaAdmin.getSchema.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas',
        action: ConduitRouteActions.GET,
        description: `Returns queried schemas and their total count.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
          enabled: ConduitBoolean.Optional,
          owner: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('GetSchemas', {
        schemas: ['_DeclaredSchema'],
        count: ConduitNumber.Required,
      }),
      this.schemaAdmin.getSchemas.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas',
        action: ConduitRouteActions.POST,
        description: `Creates a new schema.`,
        bodyParams: {
          name: ConduitString.Required,
          fields: ConduitJson.Required,
          conduitOptions: {
            cms: {
              crudOperations: {
                create: {
                  enabled: ConduitBoolean.Optional,
                  authenticated: ConduitBoolean.Optional,
                },
                read: {
                  enabled: ConduitBoolean.Optional,
                  authenticated: ConduitBoolean.Optional,
                },
                update: {
                  enabled: ConduitBoolean.Optional,
                  authenticated: ConduitBoolean.Optional,
                },
                delete: {
                  enabled: ConduitBoolean.Optional,
                  authenticated: ConduitBoolean.Optional,
                },
              },
            },
            permissions: {
              extendable: ConduitBoolean.Optional,
              canCreate: ConduitBoolean.Optional,
              canModify: ConduitString.Optional,
              canDelete: ConduitBoolean.Optional,
            },
          },
        },
      },
      new ConduitRouteReturnDefinition('CreateSchema', '_DeclaredSchema'),
      this.schemaAdmin.createSchema.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:id',
        action: ConduitRouteActions.PATCH,
        description: `Updates a schema.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
        bodyParams: {
          fields: ConduitJson.Optional,
          conduitOptions: {
            cms: {
              crudOperations: {
                create: {
                  enabled: ConduitBoolean.Optional,
                  authenticated: ConduitBoolean.Optional,
                },
                read: {
                  enabled: ConduitBoolean.Optional,
                  authenticated: ConduitBoolean.Optional,
                },
                update: {
                  enabled: ConduitBoolean.Optional,
                  authenticated: ConduitBoolean.Optional,
                },
                delete: {
                  enabled: ConduitBoolean.Optional,
                  authenticated: ConduitBoolean.Optional,
                },
              },
            },
            permissions: {
              extendable: ConduitBoolean.Optional,
              canCreate: ConduitBoolean.Optional,
              canModify: ConduitString.Optional,
              canDelete: ConduitBoolean.Optional,
            },
          },
        },
      },
      new ConduitRouteReturnDefinition('PatchSchema', '_DeclaredSchema'),
      this.schemaAdmin.patchSchema.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas',
        action: ConduitRouteActions.DELETE,
        description: `Deletes queried schemas.`,
        queryParams: {
          ids: [ConduitString.Required], // handler array check is still required
          deleteData: ConduitBoolean.Required,
        },
      },
      new ConduitRouteReturnDefinition('DeleteSchemas', 'String'),
      this.schemaAdmin.deleteSchemas.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:id',
        action: ConduitRouteActions.DELETE,
        description: `Deletes a schema.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
        queryParams: {
          deleteData: ConduitBoolean.Required,
        },
      },
      new ConduitRouteReturnDefinition('DeleteSchema', 'String'),
      this.schemaAdmin.deleteSchema.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/toggle',
        action: ConduitRouteActions.POST,
        description: `Enables/disables queried schemas.`,
        bodyParams: {
          ids: [ConduitString.Required], // handler array check is still required
          enabled: ConduitBoolean.Required,
        },
      },
      new ConduitRouteReturnDefinition('ToggleSchemas', {
        updatedSchemas: ['_DeclaredSchema'],
        enabled: ConduitBoolean.Required,
      }),
      this.schemaAdmin.toggleSchemas.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:id/toggle',
        action: ConduitRouteActions.POST,
        description: `Enables/disables a schema.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('ToggleSchema', {
        name: ConduitString.Required,
        enabled: ConduitBoolean.Required,
      }),
      this.schemaAdmin.toggleSchema.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:schemaId/extensions',
        action: ConduitRouteActions.POST,
        description: `Sets a database-owned extension for target schema, expanding it 
                        with additional fields. Passing an empty fields object removes the extension.`,
        urlParams: {
          schemaId: { type: RouteOptionType.String, required: true },
        },
        bodyParams: {
          fields: ConduitJson.Required,
        },
      },
      new ConduitRouteReturnDefinition('SetSchemaExtension', DeclaredSchema.fields),
      this.schemaAdmin.setSchemaExtension.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:id/permissions',
        action: ConduitRouteActions.PATCH,
        description: `Updates schema permissions.`,
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
      this.schemaAdmin.setSchemaPerms.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/introspection',
        action: ConduitRouteActions.GET,
        description: `Returns introspection status.`,
      },
      new ConduitRouteReturnDefinition('GetIntrospectionStatus', {
        foreignSchemas: [ConduitString.Required],
        foreignSchemaCount: ConduitNumber.Required,
        pendingSchemas: [ConduitString.Required],
        pendingSchemasCount: ConduitNumber.Required,
        importedSchemas: [ConduitString.Required],
        importedSchemaCount: ConduitNumber.Required,
      }),
      this.schemaAdmin.getIntrospectionStatus.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/introspection',
        action: ConduitRouteActions.POST,
        description: `Performs database introspection, registering any unknown
                        collections as pending schemas.`,
      },
      new ConduitRouteReturnDefinition('IntrospectDatabase', 'String'),
      this.schemaAdmin.introspectDatabase.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/introspection/schemas/:id',
        action: ConduitRouteActions.GET,
        description: `Returns a pending schema.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('GetSPendingSchema', PendingSchemas.fields),
      this.schemaAdmin.getPendingSchema.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/introspection/schemas',
        action: ConduitRouteActions.GET,
        description: `Returns queried pending schemas.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetPendingSchemas', {
        schemas: [PendingSchemas.fields],
      }),
      this.schemaAdmin.getPendingSchemas.bind(this.schemaAdmin),
    );
    this.routingManager.route(
      {
        path: '/introspection/schemas/finalize',
        action: ConduitRouteActions.POST,
        description: `Converts a previously imported pending schema to a CMS schema.`,
        bodyParams: {
          schemas: { type: [PendingSchemas.fields], required: true },
        },
      },
      new ConduitRouteReturnDefinition('FinalizeSchemas', TYPE.String),
      this.schemaAdmin.finalizeSchemas.bind(this.schemaAdmin),
    );
    // Documents
    this.routingManager.route(
      {
        path: '/schemas/:schemaName/docs/:id',
        action: ConduitRouteActions.GET,
        description: `Returns a document.`,
        urlParams: {
          schemaName: { type: RouteOptionType.String, required: true },
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('GetDocument', TYPE.JSON),
      this.documentsAdmin.getDocument.bind(this.documentsAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:schemaName/query',
        action: ConduitRouteActions.POST,
        description: `Returns queried documents.`,
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
      this.documentsAdmin.getDocuments.bind(this.documentsAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:schemaName/docs',
        action: ConduitRouteActions.POST,
        description: `Creates a new document.`,
        urlParams: {
          schemaName: { type: RouteOptionType.String, required: true },
        },
        bodyParams: {
          inputDocument: ConduitJson.Required,
        },
      },
      new ConduitRouteReturnDefinition('CreateDocument', TYPE.JSON),
      this.documentsAdmin.createDocument.bind(this.documentsAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:schemaName/docs/many',
        action: ConduitRouteActions.POST,
        description: `Creates multiple documents.`,
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
      this.documentsAdmin.createDocuments.bind(this.documentsAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:schemaName/docs',
        action: ConduitRouteActions.UPDATE,
        description: `Updates multiple documents.`,
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
      this.documentsAdmin.updateDocuments.bind(this.documentsAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:schemaName/docs/:id',
        action: ConduitRouteActions.UPDATE,
        description: `Updates a document.`,
        urlParams: {
          schemaName: { type: RouteOptionType.String, required: true },
          id: { type: RouteOptionType.String, required: true },
        },
        bodyParams: {
          changedDocument: ConduitJson.Required,
        },
      },
      new ConduitRouteReturnDefinition('UpdateDocument', TYPE.JSON),
      this.documentsAdmin.updateDocument.bind(this.documentsAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:schemaName/docs/:id',
        action: ConduitRouteActions.DELETE,
        description: `Deletes a document.`,
        urlParams: {
          schemaName: { type: RouteOptionType.String, required: true },
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('DeleteDocument', 'String'),
      this.documentsAdmin.deleteDocument.bind(this.documentsAdmin),
    );
    // Custom Endpoints
    this.routingManager.route(
      {
        path: '/customEndpoints/schemas',
        action: ConduitRouteActions.GET,
        description: `Returns queried schemas with custom endpoints.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetSchemasWithCustomEndpoints', {
        schemaNames: [ConduitString.Required],
        schemaIds: [ConduitString.Required],
      }),
      this.customEndpointsAdmin.getSchemasWithCustomEndpoints.bind(
        this.customEndpointsAdmin,
      ),
    );
    this.routingManager.route(
      {
        path: '/customEndpoints',
        action: ConduitRouteActions.GET,
        description: `Returns queried custom endpoints and their total count.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
          operation: ConduitNumber.Optional,
          schemaName: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('GetCustomEndpoints', {
        customEndpoints: [CustomEndpoints.fields],
        count: ConduitNumber.Required,
      }),
      this.customEndpointsAdmin.getCustomEndpoints.bind(this.customEndpointsAdmin),
    );
    this.routingManager.route(
      {
        path: '/customEndpoints',
        action: ConduitRouteActions.POST,
        description: `Creates a new custom endpoint.`,
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
      this.customEndpointsAdmin.createCustomEndpoint.bind(this.customEndpointsAdmin),
    );
    this.routingManager.route(
      {
        path: '/customEndpoints/:id',
        action: ConduitRouteActions.PATCH,
        description: `Updates a custom endpoint.`,
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
      this.customEndpointsAdmin.patchCustomEndpoint.bind(this.customEndpointsAdmin),
    );
    this.routingManager.route(
      {
        path: '/customEndpoints/:id',
        action: ConduitRouteActions.DELETE,
        description: `Deletes a custom endpoint.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('deleteCustomEndpoint', 'String'),
      this.customEndpointsAdmin.deleteCustomEndpoint.bind(this.customEndpointsAdmin),
    );
    this.routingManager.route(
      {
        path: '/schemas/:schemaId/cms/operation/:operation/details',
        action: ConduitRouteActions.GET,
        description:
          'Returns accessible schema fields for target CMS operation (applicable for custom endpoints)',
        urlParams: {
          schemaId: ConduitString.Required,
          operation: ConduitNumber.Required,
        },
      },
      new ConduitRouteReturnDefinition('schemaDetailsForOperation', {
        schemaId: ConduitString.Required,
        schemaName: ConduitString.Required,
        accessibleFields: ConduitJson.Required,
      }),
      this.customEndpointsAdmin.schemaDetailsForOperation.bind(this.customEndpointsAdmin),
    );
    this.routingManager.route(
      {
        path: 'schemas/:id/indexes',
        action: ConduitRouteActions.POST,
        description: `Creates indexes for a schema.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
        bodyParams: {
          indexes: [ConduitJson.Required],
        },
      },
      new ConduitRouteReturnDefinition('CreateSchemaIndexes', 'String'),
      this.schemaAdmin.createIndexes.bind(this.schemaAdmin),
    );
    this.routingManager.registerRoutes();
  }
}
