import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export async function migrateCrudOperations(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  const model = adapter.getSchemaModel('_DeclaredSchema').model;
  const cmsSchemas = await model.findMany({
    $or: [
      { 'modelOptions.conduit.cms.crudOperations': true },
      { 'modelOptions.conduit.cms.crudOperations': false },
    ],
  });
  for (const schema of cmsSchemas) {
    const { crudOperations, authentication, enabled } = schema.modelOptions.conduit.cms;
    const cms = {
      enabled: enabled,
      crudOperations: {
        create: {
          enabled: crudOperations,
          authenticated: authentication,
        },
        read: {
          enabled: crudOperations,
          authenticated: authentication,
        },
        update: {
          enabled: crudOperations,
          authenticated: authentication,
        },
        delete: {
          enabled: crudOperations,
          authenticated: authentication,
        },
      },
    };
    const id = schema._id.toString();
    await model.findByIdAndUpdate(id, {
      modelOptions: {
        conduit: { cms },
      },
    });
  }
}
