import { GrpcError, Indexable, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema.js';
import { Doc, Schema } from '../../interfaces/index.js';

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
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
  } else {
    updatedDocument = await model
      .findByIdAndUpdate(id, data, {
        userId: options.userId,
        scope: options.scope,
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
  }
  updatedDocument = await model
    .findOne(
      { _id: updatedDocument._id },
      {
        populate: options.populate,
        userId: options.userId,
        scope: options.scope,
      },
    )
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

  return updatedDocument;
}
