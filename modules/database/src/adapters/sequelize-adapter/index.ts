import { Sequelize } from 'sequelize';
import { SequelizeSchema } from './SequelizeSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitSchema, GrpcError } from '@conduitplatform/grpc-sdk';
import { systemRequiredValidator } from '../utils/validateSchemas';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { stitchSchema } from "../utils/extensions";
import { status } from '@grpc/grpc-js';

export class SequelizeAdapter extends DatabaseAdapter<SequelizeSchema> {
  connected: boolean = false;
  connectionUri: string;
  sequelize: Sequelize;
  registeredSchemas: Map<string, ConduitSchema>;

  constructor(connectionUri: string) {
    super();
    this.registeredSchemas = new Map();
    this.connectionUri = connectionUri;
    this.sequelize = new Sequelize(this.connectionUri, { logging: false });
  }

  async createSchemaFromAdapter(schema: ConduitSchema): Promise<SequelizeSchema> {
    if (!this.models) {
      this.models = {};
    }

    if (this.registeredSchemas.has(schema.name)) {
      if (schema.name !== 'Config') {
        schema = systemRequiredValidator(
          this.registeredSchemas.get(schema.name)!,
          schema,
        );
      }
      delete this.sequelize.models[schema.name];
    }
    const owned = await this.checkModelOwnership(schema);
    if (!owned) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to modify model');
    }

    this.addSchemaPermissions(schema);
    const original: any = JSON.parse(JSON.stringify(schema));
    stitchSchema(schema);
    const newSchema = schemaConverter(schema);

    this.registeredSchemas.set(schema.name, schema);
    this.models[schema.name] = new SequelizeSchema(
      this.sequelize,
      newSchema,
      schema,
      this,
    );
    await this.models[schema.name].sync();
    if (schema.name !== '_DeclaredSchema') {
      await this.saveSchemaToDatabase(original);
    }
    return this.models![schema.name];
  }

  async deleteSchema(schemaName: string, deleteData: boolean, callerModule: string = 'database'): Promise<string> {
    if (!this.models?.[schemaName])
      throw new GrpcError(status.NOT_FOUND, 'Requested schema not found');
    if (
      (this.models[schemaName].originalSchema.ownerModule !== callerModule) &&
      (this.models[schemaName].originalSchema.name !== 'SchemaDefinitions') // SchemaDefinitions migration
    ) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to delete schema');
    }
    if (deleteData) {
      await this.models![schemaName].model.drop();
    }
    this.models!['_DeclaredSchema']
      .findOne(JSON.stringify({ name: schemaName }))
      .then((model) => {
        if (model) {
          this.models!['_DeclaredSchema']
            .deleteOne(JSON.stringify({ name: schemaName }))
            .catch((e: Error) => {
              throw new GrpcError(status.INTERNAL, e.message);
            });
        }
      });
    delete this.models![schemaName];
    delete this.sequelize.models[schemaName];
    return 'Schema deleted!';
  }

  getSchemaModel(schemaName: string): { model: SequelizeSchema; relations: any } {
    if (this.models && this.models![schemaName]) {
      const self = this;
      let relations: any = {};
      for (const key in this.models[schemaName].relations) {
        relations[this.models[schemaName].relations[key]] = self.models![
          this.models[schemaName].relations[key]
          ];
      }
      return { model: this.models[schemaName], relations };
    }
    throw new GrpcError(status.NOT_FOUND, `Schema ${schemaName} not defined yet`);
  }

  async ensureConnected(): Promise<any> {
    return this.sequelize
      .authenticate()
      .then(() => {
        console.log('Sequelize connection established successfully');
        return;
      })
      .catch((err: any) => {
        console.error('Unable to connect to the database: ', err);
        throw err;
      });
  }
}
