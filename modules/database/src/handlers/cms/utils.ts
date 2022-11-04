import { GrpcError, Indexable, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';
import { Doc } from '../../interfaces';

export async function findSchema(
  call: ParsedRouterRequest,
  database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
) {
  const schemaName = call.request.path.split('/')[2];
  const schema = await database
    .getSchemaModel('_DeclaredSchema')
    .model?.findOne({ name: schemaName })
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
  if (!schema) {
    throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
  }
  return schemaName;
}

export async function getUpdatedDocument(
  schemaName: string,
  params: Indexable,
  database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  updateProvidedOnly: boolean,
) {
  const id = params.id;
  let updatedDocument: Doc = await database
    .getSchemaModel(schemaName)
    .model?.findByIdAndUpdate(id, params, updateProvidedOnly)
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
  updatedDocument = await database
    .getSchemaModel(schemaName)
    .model?.findOne({ _id: updatedDocument._id }, undefined, params.populate)
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

  return updatedDocument;
}

export async function getUpdatedDocuments(
  schemaName: string,
  params: Indexable,
  database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  updateProvidedOnly: boolean,
) {
  const updatedDocuments: Doc[] = [];
  for (const doc of params.docs) {
    const updatedDocument = await database
      .getSchemaModel(schemaName)
      .model?.findByIdAndUpdate(doc._id, doc, updateProvidedOnly)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    updatedDocuments.push(updatedDocument);
  }

  return updatedDocuments;
}
