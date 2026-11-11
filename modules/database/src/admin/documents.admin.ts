import {
  ConduitGrpcSdk,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash-es';
import { populateArray, wrongFields } from '../utils/utilities.js';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema.js';
import { ConduitDatabaseSchema, Doc } from '../interfaces/index.js';
import { parseSortParam } from '../handlers/utils.js';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';

export class DocumentsAdmin {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  ) {}

  async getDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, id, populate } = call.request.params;
    const schema = this.database.getSchemaModel(schemaName);
    if (isNil(schema)) {
      throw new ModuleError(errors.SCHEMA_NOT_FOUND);
    }
    let populates;
    if (!isNil(populate)) {
      populates = populateArray(populate);
    }
    const document: Doc = await this.database
      .getSchemaModel(schemaName)
      .model.findOne({ _id: id }, { populate: populates });
    if (isNil(document)) {
      throw new ModuleError(errors.DOCUMENT_NOT_FOUND);
    }
    return document;
  }

  async getDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let { query } = call.request.params;
    const { schemaName, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const schema = this.database.getSchemaModel(schemaName);
    if (isNil(schema)) {
      throw new ModuleError(errors.SCHEMA_NOT_FOUND);
    }
    if (!query || query.length === '') {
      query = {};
    }
    let parsedSort: { [key: string]: -1 | 1 } | undefined = undefined;
    if (sort) {
      parsedSort = parseSortParam(sort);
    }
    const documentsPromise = this.database
      .getSchemaModel(schemaName)
      .model.findMany(query, { skip, limit, sort: parsedSort });
    const countPromise = this.database
      .getSchemaModel(schemaName)
      .model.countDocuments(query);

    const [documents, count] = await Promise.all([documentsPromise, countPromise]);

    return { documents, count };
  }

  async createDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, inputDocument } = call.request.params;
    const schema = this.database.getSchemaModel(schemaName);
    if (isNil(schema) || this.database.systemSchemas.includes(schemaName)) {
      throw new ModuleError(errors.SCHEMA_DOCUMENTS_NOT_MODIFIABLE);
    }
    return await this.database.getSchemaModel(schemaName).model.create(inputDocument);
  }

  async createDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, inputDocuments } = call.request.params;
    const schema = this.database.getSchemaModel(schemaName);
    if (isNil(schema) || this.database.systemSchemas.includes(schemaName)) {
      throw new ModuleError(errors.SCHEMA_DOCUMENTS_NOT_MODIFIABLE);
    }
    const newDocuments = await this.database
      .getSchemaModel(schemaName)
      .model.createMany(inputDocuments);
    return { docs: newDocuments };
  }

  async updateDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, id, changedDocument } = call.request.params;
    const schema = this.database.getSchemaModel(schemaName);
    if (isNil(schema) || this.database.systemSchemas.includes(schemaName)) {
      throw new ModuleError(errors.SCHEMA_DOCUMENTS_NOT_MODIFIABLE);
    }
    const currentFields = Object.keys(
      (schema.model.originalSchema as ConduitDatabaseSchema).compiledFields,
    );
    const changedFields = Object.keys(changedDocument);
    if (!wrongFields(currentFields, changedFields)) {
      throw new ModuleError(errors.DOCUMENT_FIELDS_INVALID);
    }
    const dbDocument: Doc = await this.database
      .getSchemaModel(schemaName)
      .model.findOne({ _id: id });
    if (isNil(dbDocument)) {
      throw new ModuleError(errors.DOCUMENT_NOT_FOUND);
    }

    Object.assign(dbDocument, changedDocument);
    return await this.database
      .getSchemaModel(schemaName)
      .model.findByIdAndUpdate(dbDocument._id, dbDocument);
  }

  async updateDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, changedDocuments } = call.request.params;
    const schema = this.database.getSchemaModel(schemaName);
    if (isNil(schema) || this.database.systemSchemas.includes(schemaName)) {
      throw new ModuleError(errors.SCHEMA_DOCUMENTS_NOT_MODIFIABLE);
    }
    const updatedDocuments: UntypedArray = [];
    for (const doc of changedDocuments) {
      const dbDocument: Doc = await this.database
        .getSchemaModel(schemaName)
        .model.findOne({ _id: doc._id });
      if (isNil(dbDocument)) {
        throw new ModuleError(errors.DOCUMENT_NOT_FOUND);
      }
      Object.assign(dbDocument, doc);
      const updatedDocument = await this.database
        .getSchemaModel(schemaName)
        .model.findByIdAndUpdate(dbDocument._id, dbDocument);
      updatedDocuments.push(updatedDocument);
    }
    return { docs: updatedDocuments };
  }

  async deleteDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, id } = call.request.params;
    const schema = this.database.getSchemaModel(schemaName);
    if (isNil(schema) || this.database.systemSchemas.includes(schemaName)) {
      throw new ModuleError(errors.SCHEMA_DOCUMENTS_NOT_MODIFIABLE);
    }
    await this.database.getSchemaModel(schemaName).model.deleteOne({ _id: id });
    return 'Ok';
  }
}
