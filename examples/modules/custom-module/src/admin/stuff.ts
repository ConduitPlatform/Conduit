import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { constructSortObj, populateArray } from '../utils';
import grpc from 'grpc';

export class Stuff {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async getStuff(call: any, callback: any) {
    // parse all the parameters coming from the router
    // these params include headers, query params, url params and body
    let params = JSON.parse(call.request.params);
    let skip = params.skip;
    let limit = params.limit;

    // sort and populate parameters require specific parsing right now
    let sortObj: any = null;
    if (params.sort && params.sort.length > 0) {
      sortObj = constructSortObj(params.sort);
    }
    params.populate = populateArray(params.populate);

    // Query the database by providing the Schema name and the various options.
    // All options beside the Schema name and query, are optional.
    let stuff: any[] = await this.grpcSdk.databaseProvider!.findMany(
      'Stuff',
      {},
      undefined,
      skip,
      limit,
      sortObj,
      params.populate
    );
    let documentsCount: number = await this.grpcSdk.databaseProvider!.countDocuments(
      'Stuff',
      {}
    );
    /**
     Provide a grpc response, with null error and the returning objects, stringified
     inside a "result" field. This is important because the router is dynamic and it needs
     a constant field to parse.
     **/
    return callback(null, {
      result: JSON.stringify({ documents: stuff, documentsCount }),
    });
  }

  async updateStuff(call: any, callback: any) {
    let params = JSON.parse(call.request.params);
    params.populate = populateArray(params.populate);

    if (!params.id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'id is required' });
    }
    if (!params.supplier) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'supplier is required',
      });
    }

    return callback(null, { result: JSON.stringify({ ...supplier }) });
  }

  async updatePartOfStuff(call: any, callback: any) {
    let params = JSON.parse(call.request.params);
    params.populate = populateArray(params.populate);

    if (!params.id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'id is required' });
    }
    if (!params.supplier) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'supplier is required',
      });
    }

    return callback(null, { result: JSON.stringify({ ...supplier }) });
  }

  async createStuff(call: any, callback: any) {
    let params = JSON.parse(call.request.params);
    params.populate = populateArray(params.populate);

    if (!params.id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'id is required' });
    }
    if (!params.supplier) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'supplier is required',
      });
    }

    return callback(null, { result: JSON.stringify({ ...supplier }) });
  }

  async deleteStuff(call: any, callback: any) {
    let params = JSON.parse(call.request.params);
    if (!params.id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'id is required' });
    }
    let supplier = await this.grpcSdk.databaseProvider!.findOne('suppliers', {
      _id: params.id,
    });

    if (!supplier) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Supplier not found' });
    }

    await this.grpcSdk.databaseProvider!.deleteOne('suppliers', { _id: params.id });
    await this.grpcSdk.authentication!.userDelete(supplier.user);

    return callback(null, { result: 'Done' });
  }
}
