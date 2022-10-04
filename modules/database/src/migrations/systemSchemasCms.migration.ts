import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { IDeclaredSchema } from '../interfaces';

/*
 Removes 'cms' model option from Database's system schemas and deletes any registered CustomEndpoints.
 Shouldn't require a controller refresh via bus as this runs before Router is available.
 */

export async function migrateSystemSchemasCms(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  const declaredSchemas = adapter.getSchemaModel('_DeclaredSchema').model;
  const affectedSchemas: IDeclaredSchema[] = await declaredSchemas.findMany({
    $and: [
      { name: { $in: adapter.systemSchemas } },
      { 'modelOptions.conduit.cms': { $exists: true } },
    ],
  });

  if (affectedSchemas.length > 0) {
    for (const schema of affectedSchemas) {
      const conduit = schema.modelOptions.conduit;
      delete conduit!.cms;
      await declaredSchemas.findByIdAndUpdate(schema._id, {
        modelOptions: {
          conduit,
        },
      });
    }
    const customEndpoints = adapter.getSchemaModel('CustomEndpoints').model;
    const affectedSchemaNames = affectedSchemas.map(s => s.name);
    await customEndpoints.deleteMany({ selectedSchema: { $in: affectedSchemaNames } });
  }
}
