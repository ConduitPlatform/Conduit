import ConduitGrpcSdk, {
  DatabaseProvider,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { _DeclaredSchema } from '../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';

export class CmsHandlers {
  private database?: DatabaseProvider;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.initDb(grpcSdk).then(() => {
    });
  }

  async getDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, sort, populate } = call.request.params;
    const schemaName = call.request.path.split('/')[2];
    const schema = await _DeclaredSchema.getInstance()
      ?.findOne({ name: schemaName });
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

    const documentsPromise = this.database?.findMany(
      schemaName,
      {},
      undefined,
      skipNumber,
      limitNumber,
      sort,
      populate,
    );
    const countPromise = this.database?.countDocuments(schemaName, {});
    const [documents, count] = await Promise.all([
      documentsPromise,
      countPromise,
    ]);

    return { documents, count };
  }

  async getDocumentById(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, populate } = call.request.params;
    const schemaName = call.request.path.split('/')[2];
    const schema = await _DeclaredSchema.getInstance()
      ?.findOne({ name: schemaName });

    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    const document: { [key: string]: any } | undefined = await this.database
      ?.findOne(schemaName, { _id: id }, undefined, populate);
    if (!document) {
      throw new GrpcError(status.NOT_FOUND, 'Document does not exist');
    }
    return document;
  }

  async createDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const inputDocument = call.request.params;
    const schemaName = call.request.path.split('/')[2];
    const schema = await _DeclaredSchema.getInstance()
      ?.findOne({ name: schemaName });

    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    return this.database!.create(schemaName, inputDocument);
  }

  async createManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const inputDocuments = call.request.params.docs;
    const schemaName = call.request.path.split('/')[2];
    const schema = await _DeclaredSchema.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    const newDocuments = await this.database
      ?.createMany(schemaName, inputDocuments)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return { docs: newDocuments };
  }

  async updateDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    const id = params.id;
    const schemaName = call.request.path.split('/')[2];
    const schema = await _DeclaredSchema.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    let updatedDocument: any = await this.database
      ?.findByIdAndUpdate(schemaName, id, params)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    updatedDocument = await this.database
      ?.findOne(schemaName, { _id: updatedDocument._id }, undefined, params.populate)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return updatedDocument;
  }

  async patchDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    const id = params.id;
    const schemaName = call.request.path.split('/')[2];
    const schema = await _DeclaredSchema.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    let updatedDocument: any = await this.database
      ?.findByIdAndUpdate(schemaName, id, params, true)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    updatedDocument = await this.database
      ?.findOne(schemaName, { _id: updatedDocument._id }, undefined, params.populate)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return updatedDocument;
  }

  async updateManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    const schemaName = call.request.path.split('/')[2];
    const schema = await _DeclaredSchema.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    let updatedDocuments: any[] = [];
    for (const doc of params.docs) {
      const updatedDocument = await this.database
        ?.findByIdAndUpdate(schemaName, doc._id, doc)
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
    const schema = await _DeclaredSchema.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    let updatedDocuments: any[] = [];
    for (const doc of params.docs) {
      const updatedDocument = await this.database
        ?.findByIdAndUpdate(schemaName, doc._id, doc, true)
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
    const schema = await _DeclaredSchema.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    if (!schema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    await this.database
      ?.deleteOne(schemaName, { _id: id })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return 'Ok';
  }

  private async initDb(grpcSdk: ConduitGrpcSdk) {
    await grpcSdk.waitForExistence('database');
    this.database = grpcSdk.databaseProvider!;
  }
}
