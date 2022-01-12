import ConduitGrpcSdk, { ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';
import { _DeclaredSchema } from '../../models';
import { CmsRoutes } from '../../routes/routes';
import { sortAndConstructRoutes } from './utils';
import { isNil } from 'lodash';

export class SchemaController {
  private _adapter: any;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private router: CmsRoutes,
    private readonly stateActive: boolean
  ) {
    this._adapter = this.grpcSdk.databaseProvider!;
    this.loadExistingSchemas();
    if (stateActive) {
      this.initializeState();
    }
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('cms', (message: string) => {
      if (message === 'schema') {
        this.refreshRoutes();
      }
    });
  }

  refreshRoutes() {
    _DeclaredSchema
      .getInstance(this.grpcSdk.databaseProvider!)
      .findMany({ modelOptions: { conduit: { cms: { enabled: true } } } })
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
    const createdSchema = await this._adapter
      .createSchemaFromAdapter(schema)
      .catch((err: any) => {
        console.log('Failed to create schema for cms');
        console.log(err);
      });
    if (this.stateActive) {
      this.grpcSdk.bus?.publish('cms', 'schema');
    }
    this.refreshRoutes();
    return createdSchema;
  }

  private async loadExistingSchemas() {
    _DeclaredSchema
      .getInstance(this.grpcSdk.databaseProvider!)
      .findMany({ modelOptions: { conduit: { cms: { enabled: true } } } })
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
              return this._adapter.createSchemaFromAdapter(schema);
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
