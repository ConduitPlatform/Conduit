import ConduitGrpcSdk, {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { Doc } from '../interfaces';

export class CmsHandlers {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  ) {}

  async getDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, sort, populate } = call.request.params;
    const schemaName = call.request.path.split('/')[2];
    const schema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model?.findOne({ name: schemaName });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    let skipNumber = 0,
      limitNumber = 25;
    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const documentsPromise = this.database
      .getSchemaModel(schemaName)
      .model.findMany({}, skipNumber, limitNumber, undefined, sort, populate);
    const countPromise = this.database
      .getSchemaModel(schemaName)
      .model.countDocuments({});
    const [documents, count] = await Promise.all([documentsPromise, countPromise]);

    return { documents, count };
  }

  async getDocumentById(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, populate } = call.request.params;
    const schemaName = call.request.path.split('/')[2];
    const schema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model?.findOne({ name: schemaName });

    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    const document: Doc | undefined = await this.database
      .getSchemaModel(schemaName)
      .model?.findOne({ _id: id }, authzResult.fields, populate);
    if (!document) {
      throw new GrpcError(status.NOT_FOUND, 'Document does not exist');
    }
    return document;
  }

  async createDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const inputDocument = call.request.params;
    const schemaName = call.request.path.split('/')[2];
    const schema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model?.findOne({ name: schemaName });

    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    return this.database.getSchemaModel(schemaName).model!.create(inputDocument);
  }

  async createManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const inputDocuments = call.request.params.docs;
    const schemaName = call.request.path.split('/')[2];
    const schema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    const newDocuments = await this.database
      .getSchemaModel(schemaName)
      .model?.createMany(inputDocuments)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return { docs: newDocuments };
  }

  async updateDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    const id = params.id;
    const schemaName = call.request.path.split('/')[2];
    const schema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    let updatedDocument: Doc = await this.database
      .getSchemaModel(schemaName)
      .model?.findByIdAndUpdate(id, params)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    updatedDocument = await this.database
      .getSchemaModel(schemaName)
      .model?.findOne({ _id: updatedDocument._id }, undefined, params.populate)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return updatedDocument;
  }

  async patchDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    const id = params.id;
    const schemaName = call.request.path.split('/')[2];
    const schema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    let updatedDocument: Doc = await this.database
      .getSchemaModel(schemaName)
      .model?.findByIdAndUpdate(id, params, true)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    updatedDocument = await this.database
      .getSchemaModel(schemaName)
      .model?.findOne({ _id: updatedDocument._id }, undefined, params.populate)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return updatedDocument;
  }

  async updateManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    const schemaName = call.request.path.split('/')[2];
    const schema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    const updatedDocuments: Doc[] = [];
    for (const doc of params.docs) {
      const updatedDocument = await this.database
        .getSchemaModel(schemaName)
        .model?.findByIdAndUpdate(doc._id, doc)
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      updatedDocuments.push(updatedDocument);
    }

    return { docs: updatedDocuments };
  }

  async patchManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    const schemaName = call.request.path.split('/')[2];
    const schema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    const updatedDocuments: Doc[] = [];
    for (const doc of params.docs) {
      const updatedDocument = await this.database
        .getSchemaModel(schemaName)
        .model?.findByIdAndUpdate(doc._id, doc, true)
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      updatedDocuments.push(updatedDocument);
    }

    return { docs: updatedDocuments };
  }

  async deleteDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const schemaName = call.request.path.split('/')[2];
    const schema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    await this.database
      .getSchemaModel(schemaName)
      .model?.deleteOne({ _id: id })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return 'Ok';
  }
}
