import ConduitGrpcSdk, {
  DatabaseProvider,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { SchemaDefinitions } from '../models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';

export class CmsHandlers {
  private database?: DatabaseProvider;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.initDb(grpcSdk);
  }

  async getDocuments(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit, sort, populate } = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[2];

    let errorMessage: any = null;
    const schema = await SchemaDefinitions.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
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
      populate
    );
    const countPromise = this.database?.countDocuments(schemaName, {});

    const [documents, documentsCount] = await Promise.all([
      documentsPromise,
      countPromise,
    ]).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }

    return callback(null, { result: JSON.stringify({ documents, documentsCount }) });
  }

  async getDocumentById(call: RouterRequest, callback: RouterResponse) {
    const { id, populate } = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[2];

    let errorMessage: any = null;
    const schema = await SchemaDefinitions.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    const document = await this.database
      ?.findOne(schemaName, { _id: id }, undefined, populate)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(document)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested document not found',
      });
    }
    return callback(null, { result: JSON.stringify(document) });
  }

  async createDocument(call: RouterRequest, callback: RouterResponse) {
    const inputDocument = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[2];

    let errorMessage: any = null;
    const schema = await SchemaDefinitions.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    const newDocument = await this.database
      ?.create(schemaName, inputDocument)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify(newDocument) });
  }

  async createManyDocuments(call: RouterRequest, callback: RouterResponse) {
    const inputDocuments = JSON.parse(call.request.params).docs;
    const schemaName = call.request.path.split('/')[2];

    let errorMessage: any = null;
    const schema = await SchemaDefinitions.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    const newDocuments = await this.database
      ?.createMany(schemaName, inputDocuments)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify({ docs: newDocuments }) });
  }

  async editDocument(call: RouterRequest, callback: RouterResponse) {
    const params = JSON.parse(call.request.params);
    const id = params.id;

    const schemaName = call.request.path.split('/')[2];

    let errorMessage: any = null;
    const schema = await SchemaDefinitions.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    let updatedDocument: any = await this.database
      ?.findByIdAndUpdate(schemaName, id, params)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    updatedDocument = await this.database
      ?.findOne(schemaName, { _id: updatedDocument._id }, undefined, params.populate)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify(updatedDocument) });
  }

  async patchDocument(call: RouterRequest, callback: RouterResponse) {
    const params = JSON.parse(call.request.params);
    const id = params.id;

    const schemaName = call.request.path.split('/')[2];

    let errorMessage: any = null;
    const schema = await SchemaDefinitions.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    let updatedDocument: any = await this.database
      ?.findByIdAndUpdate(schemaName, id, params, true)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    updatedDocument = await this.database
      ?.findOne(schemaName, { _id: updatedDocument._id }, undefined, params.populate)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify(updatedDocument) });
  }

  async editManyDocuments(call: RouterRequest, callback: RouterResponse) {
    const params = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[2];

    let errorMessage: any = null;
    const schema = await SchemaDefinitions.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    let updatedDocuments: any[] = [];

    for (const doc of params.docs) {
      const updatedDocument = await this.database
        ?.findByIdAndUpdate(schemaName, doc._id, doc)
        .catch((e: any) => (errorMessage = e.message));
      if (isNil(errorMessage)) {
        updatedDocuments.push(updatedDocument);
      }
    }

    return callback(null, { result: JSON.stringify({ docs: updatedDocuments }) });
  }

  async patchManyDocuments(call: RouterRequest, callback: RouterResponse) {
    const params = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[2];

    let errorMessage: any = null;
    const schema = await SchemaDefinitions.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    let updatedDocuments: any[] = [];

    for (const doc of params.docs) {
      const updatedDocument = await this.database
        ?.findByIdAndUpdate(schemaName, doc._id, doc, true)
        .catch((e: any) => (errorMessage = e.message));
      if (isNil(errorMessage)) {
        updatedDocuments.push(updatedDocument);
      }
    }

    return callback(null, { result: JSON.stringify({ docs: updatedDocuments }) });
  }

  async deleteDocument(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[2];

    let errorMessage: any = null;
    const schema = await SchemaDefinitions.getInstance()
      ?.findOne({ name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    await this.database
      ?.deleteOne(schemaName, { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: 'Ok' });
  }

  private async initDb(grpcSdk: ConduitGrpcSdk) {
    await grpcSdk.waitForExistence('database');
    this.database = grpcSdk.databaseProvider!;
  }
}
