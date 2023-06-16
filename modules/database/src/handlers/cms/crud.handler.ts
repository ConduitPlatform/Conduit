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
import { findSchema, getUpdatedDocument } from './utils';
import { constructSortObj } from '../utils';

export class CmsHandlers {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  ) {}

  async getDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, sort, populate, scope } = call.request.params;
    const model = findSchema(call, this.database);

    let skipNumber = 0,
      limitNumber = 25;
    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    let parsedSort: { [key: string]: -1 | 1 } | undefined = undefined;
    if (sort && sort.length > 0) {
      parsedSort = constructSortObj(sort);
    }
    const documentsPromise = model.findMany(
      {},
      {
        skip: skipNumber,
        limit: limitNumber,
        sort: parsedSort,
        populate,
        userId: call.request.context.user?._id,
        scope,
      },
    );
    const countPromise = model.countDocuments(
      {},
      { userId: call.request.context.user?._id, scope },
    );
    const [documents, count] = await Promise.all([documentsPromise, countPromise]);

    return { documents, count };
  }

  async getDocumentById(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope, id, populate } = call.request.params;
    const model = findSchema(call, this.database);
    const document: Doc | undefined = await model.findOne(
      { _id: id },
      {
        populate,
        userId: call.request.context.user?._id,
        scope,
      },
    );
    if (!document) {
      throw new GrpcError(status.NOT_FOUND, 'Document does not exist');
    }
    return document;
  }

  async createDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope } = call.request.queryParams;
    const model = findSchema(call, this.database);
    return model.create(call.request.bodyParams, {
      userId: call.request.context.user?._id,
      scope,
    });
  }

  async createManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope } = call.request.queryParams;

    const inputDocuments = call.request.params.docs;
    const model = findSchema(call, this.database);
    const newDocuments = await model
      .createMany(inputDocuments, {
        userId: call.request.context.user?._id,
        scope,
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return { docs: newDocuments };
  }

  async updateDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope } = call.request.queryParams;
    const { id } = call.request.urlParams;
    const model = findSchema(call, this.database);
    return getUpdatedDocument(model, id, false, call.request.bodyParams, {
      userId: call.request.context.user?._id,
      scope,
      populate: call.request.queryParams?.populate,
    }).catch((e: Error) => {
      throw e;
    });
  }

  async updateManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope } = call.request.queryParams;

    const model = findSchema(call, this.database);
    const updatedDocuments: Doc[] = [];
    for (const doc of call.request.params.docs) {
      const updatedDocument = await model
        .findByIdAndReplace(doc._id, doc, {
          userId: call.request.context.user?._id,
          scope,
        })
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      updatedDocuments.push(updatedDocument);
    }
    return { docs: updatedDocuments };
  }

  async patchDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope } = call.request.queryParams;
    const { id } = call.request.urlParams;
    const model = findSchema(call, this.database);
    return getUpdatedDocument(model, id, true, call.request.bodyParams, {
      userId: call.request.context.user?._id,
      scope,
      populate: call.request.queryParams?.populate,
    }).catch((e: Error) => {
      throw e;
    });
  }

  async patchManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope } = call.request.queryParams;

    const model = findSchema(call, this.database);
    const updatedDocuments: Doc[] = [];
    for (const doc of call.request.params.docs) {
      const updatedDocument = await model
        .findByIdAndUpdate(doc._id, doc, {
          userId: call.request.context.user?._id,
          scope,
        })
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      updatedDocuments.push(updatedDocument);
    }
    return { docs: updatedDocuments };
  }

  async deleteDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope } = call.request.queryParams;
    const { id } = call.request.urlParams;
    const model = findSchema(call, this.database);
    await model
      .deleteOne(
        { _id: id },
        {
          userId: call.request.context.user?._id,
          scope,
        },
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return 'Ok';
  }
}
