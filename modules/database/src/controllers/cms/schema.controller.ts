import {
  ConduitGrpcSdk,
  ConduitSchema,
  GrpcError,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { DatabaseRoutes } from '../../routes/index.js';
import { sortAndConstructRoutes } from './utils.js';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema.js';
import { CmsHandlers } from '../../handlers/cms/crud.handler.js';
import { ParsedQuery } from '../../interfaces/index.js';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';

export class SchemaController {
  private router: DatabaseRoutes;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  ) {
    this.loadExistingSchemas();
    this.initializeState();
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('database:customSchema:create', () => {
      this.refreshRoutes();
    });
  }

  setRouter(router: DatabaseRoutes) {
    this.router = router;
    this.refreshRoutes();
  }

  refreshRoutes() {
    if (!this.router) {
      return;
    }
    this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findMany({ 'modelOptions.conduit.cms.enabled': true })
      .then(r => {
        if (r) {
          const routeSchemas: Indexable = {};
          r.forEach((schema: ConduitSchema) => {
            if (typeof schema.modelOptions === 'string') {
              (schema as any).modelOptions = JSON.parse(schema.modelOptions);
            }
            if (
              schema.name !== '_DeclaredSchemas' &&
              (schema.modelOptions.conduit?.cms.crudOperations ||
                isNil(schema.modelOptions.conduit?.cms.crudOperations))
            ) {
              routeSchemas[schema.name] = schema;
            }
          });
          this._registerRoutes(routeSchemas);
          this.router!.requestRefresh();
        } else {
          ConduitGrpcSdk.Logger.error('Something went wrong while loading custom schema');
          ConduitGrpcSdk.Logger.error('No schemas emitted');
        }
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.error('Something went wrong while loading custom schema');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  async createSchema(
    schema: ConduitSchema,
    operation: 'create' | 'update' = 'create',
    imported: boolean = false,
  ): Promise<ConduitSchema> {
    if (this.database.schemaInSystemSchemas(schema.name)) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Cannot modify database-owned system schema.',
      );
    }
    schema.ownerModule = 'database';
    const createdSchema = await this.database
      .createSchemaFromAdapter(schema, imported)
      .catch(err => {
        ConduitGrpcSdk.Logger.error(`Failed to ${operation} custom schema`);
        ConduitGrpcSdk.Logger.error(err);
        throw err;
      });
    if (schema.modelOptions.conduit?.authorization?.enabled) {
      if (this.grpcSdk.isAvailable('authorization')) {
        this.grpcSdk.authorization?.defineResource({
          name: schema.name,
          relations: [
            { name: 'owner', resourceType: ['User', '*'] },
            { name: 'reader', resourceType: ['User', '*'] },
            { name: 'editor', resourceType: ['User', '*'] },
          ],
          permissions: [
            {
              name: 'read',
              roles: [
                'reader',
                'reader->read',
                'editor',
                'editor->read',
                'owner',
                'owner->read',
              ],
            },
            { name: 'edit', roles: ['editor', 'editor->edit', 'owner', 'owner->edit'] },
            {
              name: 'delete',
              roles: ['editor', 'editor->delete', 'owner', 'owner->delete'],
            },
          ],
        });
      } else {
        ConduitGrpcSdk.Logger.error(
          'Authorization service is not available, skipping resource definition',
        );
      }
    }
    if (operation === 'create') {
      this.grpcSdk.bus?.publish(
        'database:customSchema:create',
        createdSchema.originalSchema.name,
      );
    } else {
      await this.database.syncSchema(createdSchema.originalSchema.name);
      this.grpcSdk.bus?.publish(
        'database:customSchema:update',
        createdSchema.originalSchema.name,
      );
    }

    this.refreshRoutes();
    return createdSchema.originalSchema;
  }

  private async loadExistingSchemas() {
    if (!this.router) {
      return;
    }
    this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findMany({ 'modelOptions.conduit.cms.enabled': true })
      .then(r => {
        let promise = new Promise(resolve => {
          resolve('ok');
        });
        if (r) {
          r.forEach((r: ConduitSchema) => {
            if (typeof r.modelOptions === 'string') {
              (r as any).modelOptions = JSON.parse(r.modelOptions);
            }
            const schema = new ConduitSchema(
              r.name,
              r.fields,
              r.modelOptions,
              r.collectionName,
            );
            promise = promise.then(() => {
              return this.database.createSchemaFromAdapter(schema);
            });
          });
          promise.then(() => {
            const routeSchemas: Indexable = {};
            r.forEach((schema: ConduitSchema) => {
              if (schema.modelOptions.conduit?.cms?.crudOperations) {
                routeSchemas[schema.name] = schema;
              }
            });
            this._registerRoutes(routeSchemas);
            this.router!.requestRefresh();
          });
        }
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.error('Something went wrong when loading schema for cms');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  private _registerRoutes(schemas: ParsedQuery) {
    const handlers = new CmsHandlers(this.grpcSdk, this.database);
    this.router!.addRoutes(sortAndConstructRoutes(schemas, handlers));
  }
}
