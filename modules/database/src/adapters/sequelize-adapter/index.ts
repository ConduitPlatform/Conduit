import { Sequelize } from 'sequelize';
import { SequelizeSchema } from './SequelizeSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitError, ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';
import { systemRequiredValidator } from '../utils/validateSchemas';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { DeclaredSchema } from '../../models';

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
          schema
        );
      }
      delete this.sequelize.models[schema.name];
    }
    let owned = await this.checkModelOwnership(schema);
    if (!owned) {
      throw new Error('Not authorized to modify model');
    }
    let newSchema = schemaConverter(schema);

    this.registeredSchemas.set(schema.name, schema);
    this.models[schema.name] = new SequelizeSchema(
      this.sequelize,
      newSchema,
      schema,
      this
    );
    await this.models[schema.name].sync();
    await this.saveSchemaToDatabase(schema);
    return this.models![schema.name];
  }

  getSchema(schemaName: string): ConduitSchema {
    if (this.models && this.models![schemaName]) {
      return this.models[schemaName].originalSchema;
    }
    throw new Error('Schema not defined yet');
  }

  getSchemas(): ConduitSchema[] {
    if (!this.models) {
      return [];
    }

    const self = this;
    return Object.keys(this.models).map((modelName) => {
      return self.models![modelName].originalSchema;
    });
  }

  async deleteSchema(schemaName: string,deleteData: boolean): Promise<string> {
    if (!this.models?.[schemaName])
      throw ConduitError.notFound('Requested schema not found');
    if (this.models![schemaName].originalSchema.modelOptions.systemRequired) {
      throw ConduitError.forbidden("Can't delete system required schema");
    }
    if (deleteData) {
      await this.models![schemaName].model.drop()
    }
    DeclaredSchema.getInstance()
      .findOne({ name: schemaName })
      .then( model => {
        if (model) {
          DeclaredSchema.getInstance()
            .deleteOne({name: schemaName})
            .catch((err) => { throw new Error(err.message)})
        }
      });
    delete this.models![schemaName];
    delete this.sequelize.models[schemaName];
    return 'Schema deleted!'
  }

  getSchemaModel(schemaName: string): { model: SequelizeSchema; relations: any } {
    if (this.models) {
      const self = this;
      let relations: any = {};
        for (const key in this.models[schemaName].relations) {
          relations[this.models[schemaName].relations[key]] = self.models![
            this.models[schemaName].relations[key]];
        }
      return { model: this.models[schemaName], relations };
    }
    throw new Error('Schema not defined yet');
  }

  async ensureConnected(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.sequelize
        .authenticate()
        .then(() => {
          console.log('Sequelize connection established successfully');
          resolve();
        })
        .catch((err: any) => {
          console.error('Unable to connect to the database: ', err);
          reject();
        });
    });
  }
}
