import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { ConduitSchemaOptions, ConduitSchema } from '@conduitplatform/grpc-sdk';
import { isBoolean } from 'lodash';

type _ConduitSchema = Omit<ConduitSchema, 'modelOptions'> & {
  modelOptions: ConduitSchemaOptions;
};
export async function migrateCrudOperations(
  adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  const model = adapter.getSchemaModel('_DeclaredSchema').model;
  const declaredSchemas = await model.findMany({});
  const cmsSchemas = declaredSchemas.filter((schema: _ConduitSchema) =>
    isBoolean(schema.modelOptions.conduit?.cms),
  );
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
