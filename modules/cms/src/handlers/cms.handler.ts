import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';
import grpc from 'grpc';

export class CmsHandlers {
  private database: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.initDb(grpcSdk);
  }

  private async initDb(grpcSdk: ConduitGrpcSdk) {
    await grpcSdk.waitForExistence('database-provider');
    this.database = grpcSdk.databaseProvider;
  }

  async getDocuments(call: any, callback: any) {
    const { skip, limit, sort, populate } = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[3];

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    let skipNumber = 0,
      limitNumber = 25,
      sortObj: any = null;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    if (!isNil(sort) && sort.length > 0) {
      sortObj = {};
      sort.split(',').forEach((sortVal: string) => {
        sortVal = sortVal.trim();
        if (sortVal.indexOf('-') !== -1) {
          sortObj[sortVal.substr(1)] = -1;
        } else {
          sortObj[sortVal] = 1;
        }
      });
    }

    const documentsPromise = this.database.findMany(
      schemaName,
      {},
      null,
      skipNumber,
      limitNumber,
      sortObj,
      populate
    );
    const countPromise = this.database.countDocuments(schemaName, {});

    const [documents, documentsCount] = await Promise.all([
      documentsPromise,
      countPromise,
    ]).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });
    }

    return callback(null, { result: JSON.stringify({ documents, documentsCount }) });
  }

  async getDocumentById(call: any, callback: any) {
    const { id, populate } = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[3];

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    const document = await this.database
      .findOne(schemaName, { _id: id }, null, populate)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(document)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested document not found',
      });
    }
    return callback(null, { result: JSON.stringify(document) });
  }

  async createDocument(call: any, callback: any) {
    const inputDocument = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[3];

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    const newDocument = await this.database
      .create(schemaName, inputDocument)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify(newDocument) });
  }

  async createManyDocuments(call: any, callback: any) {
    const inputDocuments = JSON.parse(call.request.params).docs;
    const schemaName = call.request.path.split('/')[3];

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    const newDocuments = await this.database
      .createMany(schemaName, inputDocuments)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify({ docs: newDocuments }) });
  }

  async editDocument(call: any, callback: any) {
    const params = JSON.parse(call.request.params);
    const id = params.id;
    const schemaName = call.request.path.split('/')[3];

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    const dbDocument = await this.database
      .findOne(schemaName, { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    Object.assign(dbDocument, params);

    const updatedDocument = await this.database
      .findByIdAndUpdate(schemaName, dbDocument._id, dbDocument)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify(updatedDocument) });
  }

  async editManyDocuments(call: any, callback: any) {
    const params = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[3];

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    let updatedDocuments: any[] = [];

    for (const doc of params.docs) {
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

  async deleteDocument(call: any, callback: any) {
    const { id } = JSON.parse(call.request.params);
    const schemaName = call.request.path.split('/')[3];

    let errorMessage: any = null;
    const schema = await this.database
      .findOne('SchemaDefinitions', { name: schemaName })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(schema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested cms schema not found',
      });
    }

    await this.database
      .deleteOne(schemaName, { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, { result: 'Ok' });
  }
}
