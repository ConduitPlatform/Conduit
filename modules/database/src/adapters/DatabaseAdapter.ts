import { ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';
import { SchemaAdapter } from '../interfaces';
import { DeclaredSchema } from '../models';

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

  abstract deleteSchema(schemaName: string, deleteData: boolean): string;

  abstract getSchemaModel(
    schemaName: string
  ): { model: SchemaAdapter<any>; relations: any };

  async checkModelOwnership(schema: ConduitSchema) {
    if (schema.name === '_DeclaredSchema') return true;
    let model = await DeclaredSchema.getInstance().findOne({ name: schema.name });

    if (model && (model as any).ownerModule === schema.owner) {
      return true;
    } else if (model) {
      return false;
    }
    return true;
  }

  async saveSchemaToDatabase(schema: ConduitSchema) {
    if (schema.name === '_DeclaredSchema') return;

    let model = await DeclaredSchema.getInstance().findOne({ name: schema.name });
    if (model) {
      await DeclaredSchema.getInstance()
        .findByIdAndUpdate(
          model._id,
          {
            name: schema.name,
            fields: schema.fields,
            modelOptions: JSON.stringify(schema.modelOptions),
            ownerModule: schema.owner,
          }
        );
    } else {
      await DeclaredSchema.getInstance()
        .create({
          name: schema.name,
          fields: schema.fields,
          modelOptions: JSON.stringify(schema.modelOptions),
          ownerModule: schema.owner,
        });
    }
  }

  async recoverSchemasFromDatabase(): Promise<any> {
    let models: any = await DeclaredSchema.getInstance().findMany({});
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
      .map((model: ConduitSchema) => {
        return this.createSchemaFromAdapter(model);
      });

    await Promise.all(models);
  }

  abstract ensureConnected(): Promise<any>;
}
