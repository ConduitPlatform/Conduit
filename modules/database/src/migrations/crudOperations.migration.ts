import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export async function migrateCrudOperations(adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>) {
  const model = adapter.getSchemaModel('_DeclaredSchema').model;
  const cmsSchemas = await model
    .findMany({ 'modelOptions.conduit.cms.enabled': { $exists: true } });

  for (const schema of cmsSchemas) {
    const { crudOperations, authentication } = schema.modelOptions.conduit.cms;
    const cms = {
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
    await model.findByIdAndUpdate(schema._id, {
      conduit: { cms },
    });
  }
}
