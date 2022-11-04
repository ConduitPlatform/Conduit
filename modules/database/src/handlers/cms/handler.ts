import ConduitGrpcSdk, {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema';
import { Doc } from '../../interfaces';
import { findSchema, getUpdatedDocument, getUpdatedDocuments } from './utils';

export class CmsHandlers {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  ) {}

  async getDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, sort, populate } = call.request.params;
    const schemaName = await findSchema(call, this.database).catch((e: Error) => {
      throw e;
    });
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
    const schemaName = await findSchema(call, this.database).catch((e: Error) => {
      throw e;
    });
    const document: Doc | undefined = await this.database
      .getSchemaModel(schemaName)
      .model?.findOne(
        { _id: call.request.params.id },
        undefined,
        call.request.params.populate,
      );
    if (!document) {
      throw new GrpcError(status.NOT_FOUND, 'Document does not exist');
    }
    return document;
  }

  async createDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const schemaName = await findSchema(call, this.database).catch((e: Error) => {
      throw e;
    });

    return this.database.getSchemaModel(schemaName).model!.create(call.request.params);
  }

  async createManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const inputDocuments = call.request.params.docs;
    const schemaName = await findSchema(call, this.database).catch((e: Error) => {
      throw e;
    });
    const newDocuments = await this.database
      .getSchemaModel(schemaName)
      .model?.createMany(inputDocuments)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return { docs: newDocuments };
  }

  async updateDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const schemaName = await findSchema(call, this.database).catch((e: Error) => {
      throw e;
    });
    return getUpdatedDocument(
      schemaName,
      call.request.params,
      this.database,
      false,
    ).catch((e: Error) => {
      throw e;
    });
  }

  async patchDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const schemaName = await findSchema(call, this.database).catch((e: Error) => {
      throw e;
    });
    return getUpdatedDocument(schemaName, call.request.params, this.database, true).catch(
      (e: Error) => {
        throw e;
      },
    );
  }

  async updateManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const schemaName = await findSchema(call, this.database).catch((e: Error) => {
      throw e;
    });

    const updatedDocuments = await getUpdatedDocuments(
      schemaName,
      call.request.params,
      this.database,
      false,
    ).catch((e: Error) => {
      throw e;
    });
    return { docs: updatedDocuments };
  }

  async patchManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const schemaName = await findSchema(call, this.database).catch((e: Error) => {
      throw e;
    });
    const updatedDocuments = await getUpdatedDocuments(
      schemaName,
      call.request.params,
      this.database,
      true,
    ).catch((e: Error) => {
      throw e;
    });

    return { docs: updatedDocuments };
  }

  async deleteDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const schemaName = await findSchema(call, this.database).catch((e: Error) => {
      throw e;
    });
    await this.database
      .getSchemaModel(schemaName)
      .model?.deleteOne({ _id: call.request.params.id })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return 'Ok';
  }
}
