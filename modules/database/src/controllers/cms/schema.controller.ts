import ConduitGrpcSdk, { ConduitSchema } from '@conduitplatform/grpc-sdk';
import { CmsRoutes } from '../../routes/routes';
import { sortAndConstructRoutes } from './utils';
import { isNil } from 'lodash';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';

export class SchemaController {

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
    private router: CmsRoutes,
  ) {
    this.loadExistingSchemas();
    this.initializeState();
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('cms', (message: string) => {
      if (message === 'schema') {
        this.refreshRoutes();
      }
    });
  }

  refreshRoutes() {
    this.database.getSchemaModel('_DeclaredSchema').model
      .findMany({ 'modelOptions.conduit.cms.enabled': true })
      .then((r: any) => {
        if (r) {
          let routeSchemas: any = {};
          r.forEach((schema: any) => {
            if (typeof schema.modelOptions === 'string') {
              schema.modelOptions = JSON.parse(schema.modelOptions);
            }
            if (
              schema.name !== '_DeclaredSchemas' &&
              (schema.modelOptions.conduit.cms.crudOperations ||
                isNil(schema.modelOptions.conduit.cms.crudOperations))
            ) {
              routeSchemas[schema.name] = schema;
            }
          });
          this._registerRoutes(routeSchemas);
          this.router.requestRefresh();
        } else {
          console.error('Something went wrong when loading schema for cms');
          console.error('No schemas emitted');
        }
      })
      .catch((err: Error) => {
        console.error('Something went wrong when loading schema for cms');
        console.error(err);
      });
  }

  async createSchema(schema: ConduitSchema): Promise<ConduitSchema> {
    const createdSchema = await this.database
      .createSchemaFromAdapter(schema)
      .catch((err: any) => {
        console.log('Failed to create schema for cms');
        console.log(err);
        throw err;
      });
    this.grpcSdk.bus?.publish('cms', 'schema');
    this.refreshRoutes();
    return createdSchema.originalSchema;

  }

  private async loadExistingSchemas() {
    this.database.getSchemaModel('_DeclaredSchema').model
      .findMany({ 'modelOptions.conduit.cms.enabled': true })
      .then((r: any) => {
        let promise = new Promise((resolve, reject) => {
          resolve('ok');
        });
        if (r) {
          r.forEach((r: any) => {
            if (typeof r.modelOptions === 'string') {
              r.modelOptions = JSON.parse(r.modelOptions);
            }
            const schema = new ConduitSchema(r.name, r.fields, r.modelOptions);
            promise = promise.then((r) => {
              return this.database.createSchemaFromAdapter(schema);
            });
          });
          promise.then((p) => {
            let routeSchemas: any = {};
            r.forEach((schema: any) => {
              if (typeof schema.modelOptions === 'string') {
                schema.modelOptions = JSON.parse(schema.modelOptions);
              }
              if (
                schema.name !== 'SchemaDefinitions' &&
                (schema.modelOptions.conduit.cms.crudOperations ||
                  isNil(schema.modelOptions.conduit.cms.crudOperations))
              ) {
                routeSchemas[schema.name] = schema;
              }
            });
            this._registerRoutes(routeSchemas);
            this.router.requestRefresh();
          });
        }
      })
      .catch((err: Error) => {
        console.error('Something went wrong when loading schema for cms');
        console.error(err);
      });
  }

  private _registerRoutes(schemas: { [name: string]: any }) {
    this.router.addRoutes(sortAndConstructRoutes(schemas));
  }
}
