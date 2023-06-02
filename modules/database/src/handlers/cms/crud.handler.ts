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
import {
  collectionPermissionCheck,
  constructSortObj,
  documentPermissionAddition,
  documentPermissionCheck,
} from '../utils';

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
    let validIds = (
      await collectionPermissionCheck(
        this.grpcSdk,
        'read',
        call.request.context.user._id,
        model,
        scope,
        skip,
        limit,
      )
    )?.resources;
    let query = {};
    if (validIds && validIds.length === 0) {
      return { documents: [], count: 0 };
    } else if (validIds && validIds.length > 0) {
      query = {
        _id: { $in: validIds },
      };
    }
    const documentsPromise = model.findMany(query, {
      skip: skipNumber,
      limit: limitNumber,
      sort: parsedSort,
      populate,
    });
    const countPromise = model.countDocuments({});
    const [documents, count] = await Promise.all([documentsPromise, countPromise]);

    return { documents, count };
  }

  async getDocumentById(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope, id, populate } = call.request.params;
    const model = findSchema(call, this.database);
    await documentPermissionCheck(
      this.grpcSdk,
      'read',
      call.request.context.user._id,
      model,
      id,
      scope,
    );
    const document: Doc | undefined = await model.findOne(
      { _id: id },
      {
        populate,
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
    const document = await model.create(call.request.bodyParams);
    await documentPermissionAddition(
      this.grpcSdk,
      call.request.context.user?._id,
      model,
      document._id,
      scope,
    );
    return document;
  }

  async createManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const inputDocuments = call.request.params.docs;
    const model = findSchema(call, this.database);
    const newDocuments = await model.createMany(inputDocuments).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    if (newDocuments && newDocuments.length !== 0) {
      for (const doc of newDocuments) {
        await documentPermissionAddition(
          this.grpcSdk,
          call.request.context.user?._id,
          model,
          doc._id,
          call.request.queryParams?.scope,
        );
      }
    }
    return { docs: newDocuments };
  }

  async updateDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope } = call.request.queryParams;
    const { id } = call.request.urlParams;
    const model = findSchema(call, this.database);
    await documentPermissionCheck(
      this.grpcSdk,
      'edit',
      call.request.context?.user?._id,
      model,
      id,
      scope,
    );
    return getUpdatedDocument(
      model,
      id,
      call.request.bodyParams,
      call.request.queryParams?.populate,
    ).catch((e: Error) => {
      throw e;
    });
  }

  async updateManyDocuments(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { scope } = call.request.queryParams;

    const model = findSchema(call, this.database);
    const updatedDocuments: Doc[] = [];
    for (const doc of call.request.params.docs) {
      await documentPermissionCheck(
        this.grpcSdk,
        'edit',
        call.request.context?.user?._id,
        model,
        doc._id,
        scope,
      );
    }
    for (const doc of call.request.params.docs) {
      const updatedDocument = await model
        .findByIdAndUpdate(doc._id, doc)
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
    await documentPermissionCheck(
      this.grpcSdk,
      'delete',
      call.request.context?.user?._id,
      model,
      id,
      scope,
    );
    await model.deleteOne({ _id: id }).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

    return 'Ok';
  }
}
