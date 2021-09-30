import { DatabaseAdapter } from '../../interfaces';
import { Sequelize } from 'sequelize';
import { SequelizeSchema } from './SequelizeSchema';
import { schemaConverter } from './SchemaConverter';
import { ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';
import { systemRequiredValidator } from '../utils/validateSchemas';
export class SequelizeAdapter implements DatabaseAdapter {
  connected: boolean = false;
  connectionUri: string;
  sequelize: Sequelize;
  models: { [name: string]: SequelizeSchema };
  registeredSchemas: Map<string, ConduitSchema>;

  constructor(connectionUri: string) {
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
        try {
          schema = systemRequiredValidator(
            this.registeredSchemas.get(schema.name)!,
            schema
          );
        } catch (err) {
          return Promise.reject(err);
        }
      }
      delete this.sequelize.models[schema.name];
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

  async saveSchemaToDatabase(schema: ConduitSchema) {
    if (schema.name === '_declaredSchema') return;

    let model = await this.models!['_declaredSchema'].findOne(
      JSON.stringify({ name: schema.name })
    );
    if (model) {
      await this.models!['_declaredSchema'].findByIdAndUpdate(
        model._id,
        JSON.stringify({
          name: schema.name,
          fields: schema.fields,
          modelOptions: JSON.stringify(schema.modelOptions),
        })
      );
    } else {
      await this.models!['_declaredSchema'].create(
        JSON.stringify({
          name: schema.name,
          fields: schema.fields,
          modelOptions: JSON.stringify(schema.modelOptions),
        })
      );
    }
  }

  async recoverSchemasFromDatabase(): Promise<any> {
    let models = await this.models!['_declaredSchema'].findMany('{}');
    models = models
      .map((model: any) => {
        return new ConduitSchema(
          model.name,
          model.fields,
          JSON.parse(model.modelOptions)
        );
      })
      .map((model: ConduitSchema) => {
        return this.createSchemaFromAdapter(model);
      });

    await Promise.all(models);
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

  getSchemaModel(schemaName: string): { model: SequelizeSchema; relations: any } {
    if (this.models) {
      const self = this;
      let relations: any = {};
      for (const key in this.models[schemaName].relations) {
        relations[this.models[schemaName].relations[key]] =
          self.models[this.models[schemaName].relations[key]];
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
