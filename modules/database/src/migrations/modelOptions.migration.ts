import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { IDeclaredSchema } from '../interfaces/DeclaredSchema';

export async function migrateModelOptions(adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>) {
  const documents = await adapter.getSchemaModel('_DeclaredSchema').model
    .findMany(JSON.stringify({ 'modelOptions.conduit': { $exists: false } }));

  for (const schema of (documents as IDeclaredSchema[])) {
    let newModelOptions: any = { conduit: {} };
    try { // modelOptions could be {}
      newModelOptions = { ...newModelOptions, ...JSON.parse((schema.modelOptions as string)) };
    } catch {
      newModelOptions = { ...newModelOptions, ...schema.modelOptions };
    }
    await adapter.getSchemaModel('_DeclaredSchema').model.findByIdAndUpdate(schema._id, JSON.stringify({
      modelOptions: newModelOptions,
    })).catch((err: Error) => {
      console.log(err);
    });
  }
}
