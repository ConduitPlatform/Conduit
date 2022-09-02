import ConduitGrpcSdk, { ConduitSchema } from '@conduitplatform/grpc-sdk';
import { DatabaseRoutes } from '../../routes';
import { sortAndConstructRoutes } from './utils';
import { isNil } from 'lodash';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';
import { CmsHandlers } from '../../handlers/cms/handler';
import { ParsedQuery } from '../../interfaces';

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
          const routeSchemas: any = {};
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

  async createSchema(schema: ConduitSchema): Promise<ConduitSchema> {
    const createdSchema = await this.database
      .createCustomSchemaFromAdapter(schema)
      .catch(err => {
        ConduitGrpcSdk.Logger.error('Failed to create custom schema');
        ConduitGrpcSdk.Logger.error(err);
        throw err;
      });
    this.grpcSdk.bus?.publish(
      'database:customSchema:create',
      createdSchema.originalSchema.name,
    );
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
              return this.database.createCustomSchemaFromAdapter(schema);
            });
          });
          promise.then(() => {
            const routeSchemas: any = {};
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
