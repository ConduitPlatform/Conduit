import { isNil } from 'lodash';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export async function migrateCustomEndpoints(adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>) {
  let errorMessage: string | null = null;
  const documents: any = await adapter.getSchemaModel('CustomEndpoints').model
    .findMany('{}')
    .catch((e: Error) => (errorMessage = e.message));
  if (!isNil(errorMessage)) {
    return Promise.reject(errorMessage);
  }

  for (const document of documents) {
    if (!isNil(document.queries) && isNil(document.query)) {
      document.query = { AND: document.queries };

      await adapter.getSchemaModel('CustomEndpoints').model
        .findByIdAndUpdate(document._id, document)
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return Promise.reject(errorMessage);
      }
    }
  }
}
