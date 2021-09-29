import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { SchemaController } from '../controllers/cms/schema.controller';

export class DocumentsAdmin {
  private database: any;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly schemaController: SchemaController
  ) {
    this.database = this.grpcSdk.databaseProvider;
  }

  async getDocuments(call: RouterRequest, callback: RouterResponse) {
    let { skip, limit, schemaName, query } = JSON.parse(call.request.params);

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    if (!query || query.length === '') {
      query = {};
    }

    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const documentsPromise = this.database.findMany(
      schemaName,
      query,
      null,
      skipNumber,
      limitNumber
    );
    const countPromise = this.database.countDocuments(schemaName, query);

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
    const { schemaName, id } = JSON.parse(call.request.params);

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
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
      .findOne(schemaName, { _id: id })
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
    const { schemaName, inputDocument } = JSON.parse(call.request.params);

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
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
      .create(schemaName, inputDocument)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify(newDocument) });
  }

  async createManyDocuments(call: RouterRequest, callback: RouterResponse) {
    const { schemaName, inputDocuments } = JSON.parse(call.request.params);

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
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
      .createMany(schemaName, inputDocuments)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify({ docs: newDocuments }) });
  }

  async editDocument(call: RouterRequest, callback: RouterResponse) {
    const { schemaName, id, changedDocument } = JSON.parse(call.request.params);

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    const dbDocument = await this.database
      .findOne(schemaName, { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    Object.assign(dbDocument, changedDocument);

    const updatedDocument = await this.database
      .findByIdAndUpdate(schemaName, dbDocument._id, dbDocument)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify(updatedDocument) });
  }

  async editManyDocuments(call: RouterRequest, callback: RouterResponse) {
    const { schemaName, changedDocuments } = JSON.parse(call.request.params);

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
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

    for (const doc of changedDocuments) {
      const dbDocument = await this.database
        .findOne(schemaName, { _id: doc._id })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage)) continue; // TODO create new?

      Object.assign(dbDocument, doc);

      const updatedDocument = await this.database
        .findByIdAndUpdate(schemaName, dbDocument._id, dbDocument)
        .catch((e: any) => (errorMessage = e.message));
      if (isNil(errorMessage)) {
        updatedDocuments.push(updatedDocument);
      }
    }

    return callback(null, { result: JSON.stringify({ docs: updatedDocuments }) });
  }

  async deleteDocument(call: RouterRequest, callback: RouterResponse) {
    const { schemaName, id } = JSON.parse(call.request.params);

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
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
      .deleteOne(schemaName, { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: 'Ok' });
  }
}
