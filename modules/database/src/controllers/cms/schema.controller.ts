import ConduitGrpcSdk, { ConduitModelOptions, ConduitSchema as ConduitSchema } from '@conduitplatform/grpc-sdk';
import { DatabaseRoutes } from '../../routes/routes';
import { sortAndConstructRoutes } from './utils';
import { isNil } from 'lodash';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';
import {CmsHandlers} from "../../handlers/cms.handler";
import { ParsedQuery } from '../../interfaces';

type _ConduitSchema = ConduitSchema & {modelOptions: ConduitModelOptions}
export class SchemaController {

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
    private router: DatabaseRoutes,
  ) {
    this.loadExistingSchemas();
    this.initializeState();
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('database:customSchema:create', (message: string) => {
        this.refreshRoutes();
    });
  }

  refreshRoutes() {
    this.database.getSchemaModel('_DeclaredSchema').model
      .findMany({ 'modelOptions.conduit.cms.enabled': true })
      .then((r) => {
        if (r) {
          let routeSchemas: any = {};
          r.forEach((schema: _ConduitSchema) => {
            if (typeof schema.modelOptions === 'string') {
              schema.modelOptions = JSON.parse(schema.modelOptions);
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
          this.router.requestRefresh();
        } else {
          console.error('Something went wrong while loading custom schema');
          console.error('No schemas emitted');
        }
      })
      .catch((err: Error) => {
        console.error('Something went wrong while loading custom schema');
        console.error(err);
      });
  }

  async createSchema(schema: ConduitSchema): Promise<ConduitSchema> {
    const createdSchema = await this.database
      .createCustomSchemaFromAdapter(schema)
      .catch((err) => {
        console.log('Failed to create custom schema');
        console.log(err);
        throw err;
      });
    this.grpcSdk.bus?.publish('database:customSchema:create', createdSchema.originalSchema.name);
    this.refreshRoutes();
    return createdSchema.originalSchema;
  }

  private async loadExistingSchemas() {
    this.database.getSchemaModel('_DeclaredSchema').model
      .findMany({ 'modelOptions.conduit.cms.enabled': true })
      .then((r) => {
        let promise = new Promise((resolve, reject) => {
          resolve('ok');
        });
        if (r) {
          r.forEach((r: _ConduitSchema) => {
            if (typeof r.modelOptions === 'string') {
              r.modelOptions = JSON.parse(r.modelOptions);
            }
            const schema = new ConduitSchema(r.name, r.fields, r.modelOptions);
            promise = promise.then((r) => {
              return this.database.createCustomSchemaFromAdapter(schema);
            });
          });
          promise.then((p) => {
            let routeSchemas: any = {};
            r.forEach((schema: _ConduitSchema) => {
              if (schema.modelOptions.conduit?.cms?.crudOperations) {
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

  private _registerRoutes(schemas: ParsedQuery) {
    let handlers = new CmsHandlers(this.grpcSdk,this.database);

    this.router.addRoutes(sortAndConstructRoutes(schemas,handlers));
  }
}
