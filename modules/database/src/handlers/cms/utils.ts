import { Indexable, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema.js';
import { Doc, Schema } from '../../interfaces/index.js';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';

export function findSchema(
  call: ParsedRouterRequest,
  database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  const schemaName = call.request.path.split('/')[2];
  return database.getSchemaModel(schemaName).model;
}

export async function getUpdatedDocument(
  model: Schema,
  id: string,
  patch: boolean = false,
  data: Indexable,
  options: {
    populate?: string[];
    userId?: string;
    scope?: string;
  },
) {
  let updatedDocument: Doc;
  if (!patch) {
    updatedDocument = await model
      .findByIdAndReplace(id, data, {
        userId: options.userId,
        scope: options.scope,
      })
      .catch(ModuleError.rethrow(errors.DATABASE_OPERATION_FAILED));
  } else {
    updatedDocument = await model
      .findByIdAndUpdate(id, data, {
        userId: options.userId,
        scope: options.scope,
      })
      .catch(ModuleError.rethrow(errors.DATABASE_OPERATION_FAILED));
  }
  updatedDocument = await model
    .findOne(
      { _id: updatedDocument._id },
      {
        populate: options.populate,
        userId: options.userId,
        scope: options.scope,
        readPreference: 'primary',
      },
    )
    .catch(ModuleError.rethrow(errors.DATABASE_OPERATION_FAILED));

  return updatedDocument;
}
