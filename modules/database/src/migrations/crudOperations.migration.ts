import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { ConduitActiveSchema, ConduitSchema } from '@conduitplatform/grpc-sdk';

export async function migrateCrudOperations(adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>) {
  const model = adapter.getSchemaModel('_DeclaredSchema').model;
  let cmsSchemas = await model
    .findMany({ 'modelOptions.conduit.cms': { $exists: true } });
  cmsSchemas = cmsSchemas.filter((schema: any) => typeof schema.modelOptions.conduit!.cms.crudOperations === 'boolean');
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
    const id = (schema._id).toString();
    await model.findByIdAndUpdate(id, {
      modelOptions: {
        conduit: { cms },
      },
    });
  }
}
