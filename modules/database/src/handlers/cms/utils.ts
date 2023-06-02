import { GrpcError, Indexable, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';
import { Doc, Schema } from '../../interfaces';

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
  data: Indexable,
  populate?: string[],
) {
  let updatedDocument: Doc = await model.findByIdAndUpdate(id, data).catch((e: Error) => {
    throw new GrpcError(status.INTERNAL, e.message);
  });
  updatedDocument = await model
    .findOne({ _id: updatedDocument._id }, { populate })
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

  return updatedDocument;
}
