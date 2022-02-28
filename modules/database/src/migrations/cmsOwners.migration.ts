import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export async function cmsOwnersMigration(adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>) {
  const schemas = await adapter.getSchemaModel('_DeclaredSchema').model
    .findMany({ ownerModule: 'cms' })
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
  if (schemas.filter((schema: any) => schema.name !== 'SchemaDefinitions').length === 0)
    return;
  if (schemas.length > 0) {
    await adapter.getSchemaModel('_DeclaredSchema').model
      .updateMany({ ownerModule: 'cms' },
        { ownerModule: 'database' }, true);
  }

}
