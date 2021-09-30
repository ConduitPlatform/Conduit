import { ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';
import { SchemaAdapter } from '../interfaces';

export abstract class DatabaseAdapter<T extends SchemaAdapter<any>> {
  registeredSchemas: Map<string, ConduitSchema>;
  models?: { [name: string]: T };

  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param schema
   */
  abstract createSchemaFromAdapter(schema: ConduitSchema): Promise<SchemaAdapter<any>>;

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param schemaName
   */
  abstract getSchema(schemaName: string): ConduitSchema;

  abstract getSchemas(): ConduitSchema[];

  abstract getSchemaModel(
    schemaName: string
  ): { model: SchemaAdapter<any>; relations: any };

  async checkModelOwnership(schema: ConduitSchema) {
    let model = await this.models!['_declaredSchema'].findOne(
      JSON.stringify({ name: schema.name })
    );

    if (model && model.ownerModule === schema.owner) {
      return true;
    } else if (model) {
      return false;
    }
    return true;
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
          ownerModule: schema.owner,
        })
      );
    } else {
      await this.models!['_declaredSchema'].create(
        JSON.stringify({
          name: schema.name,
          fields: schema.fields,
          modelOptions: JSON.stringify(schema.modelOptions),
          ownerModule: schema.owner,
        })
      );
    }
  }

  async recoverSchemasFromDatabase(): Promise<any> {
    let models = await this.models!['_declaredSchema'].findMany('{}');
    models = models
      .map((model: any) => {
        let schema = new ConduitSchema(
          model.name,
          model.fields,
          JSON.parse(model.modelOptions)
        );
        schema.owner = model.ownerModule;
        return schema;
      })
      .map((model: { schema: ConduitSchema; owner: string }) => {
        return this.createSchemaFromAdapter(model.schema);
      });

    await Promise.all(models);
  }

  abstract ensureConnected(): Promise<any>;
}
