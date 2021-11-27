import ConduitGrpcSdk, {
  DatabaseProvider,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { populateArray } from '../utils/utilities';
import { SchemaDefinitions } from '../models';

const escapeStringRegexp = require('escape-string-regexp');

export class DocumentsAdmin {
  private database!: DatabaseProvider;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.database = this.grpcSdk.databaseProvider!;
  }

  async getDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, id, populate } = call.request.params;
    const schema = await SchemaDefinitions.getInstance().findOne({ name: schemaName });
    if (isNil(schema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    let populates;
    if (!isNil(populate)) {
      populates = populateArray(populate);
    }
    const document = await this.database
      .findOne(
        schemaName,
        { _id: id },
        undefined,
        populates,
      )
    if (isNil(document)) {
      throw new GrpcError(status.NOT_FOUND, 'Document does not exist');
    }
    return { document };
  }

  async getManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let { schemaName, skip, limit, query, search } = call.request.params;

    const schema = await SchemaDefinitions.getInstance().findOne({ name: schemaName });
    if (isNil(schema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    if (!query || query.length === '') {
      query = {};
    }
    let skipNumber = 0, limitNumber = 25;
    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let identifier;
    if (!isNil(search)) {
      identifier = escapeStringRegexp(search);
      query['name'] = { $regex: `.*${identifier}.*`, $options: 'i' };
    }

    const documentsPromise = this.database.findMany(
      schemaName,
      query,
      undefined,
      skipNumber,
      limitNumber,
    );
    const countPromise = this.database.countDocuments(schemaName, query);

    const [documents, documentsCount] = await Promise.all([
      documentsPromise,
      countPromise,
    ]).catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    return { documents, documentsCount };
  }

  async createDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, inputDocument } = call.request.params;
    const schema = await SchemaDefinitions.getInstance().findOne({ name: schemaName });
    if (isNil(schema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    const newDocument = await this.database
      .create(schemaName, inputDocument)
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    return { newDocument };
  }

  async createManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, inputDocuments } = call.request.params;
    const schema = await SchemaDefinitions.getInstance().findOne({ name: schemaName });
    if (isNil(schema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    const newDocuments = await this.database
      .createMany(schemaName, inputDocuments)
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    return { docs: newDocuments };
  }

  async editDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, id, changedDocument } = call.request.params;
    const schema = await SchemaDefinitions.getInstance().findOne({ name: schemaName });
    if (isNil(schema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    const dbDocument = await this.database
      .findOne(schemaName, { _id: id })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    Object.assign(dbDocument, changedDocument);

    const updatedDocument = await this.database
      .findByIdAndUpdate(schemaName, dbDocument._id, dbDocument)
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    return { updatedDocument };
  }

  async editManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, changedDocuments } = call.request.params;
    const schema = await SchemaDefinitions.getInstance().findOne({ name: schemaName });
    if (isNil(schema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    let updatedDocuments: any[] = [];
    for (const doc of changedDocuments) {
      const dbDocument = await this.database
        .findOne(schemaName, { _id: doc._id })
        .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
      Object.assign(dbDocument, doc);
      const updatedDocument = await this.database
        .findByIdAndUpdate(schemaName, dbDocument._id, dbDocument)
        .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
      updatedDocuments.push(updatedDocument);
    }
    return { docs: updatedDocuments };
  }

  async deleteDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { schemaName, id } = call.request.params;
    const schema = await SchemaDefinitions.getInstance()
      .findOne({ name: schemaName })
    if (isNil(schema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    await this.database
      .deleteOne(schemaName, { _id: id })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    return 'Ok';
  }
}
