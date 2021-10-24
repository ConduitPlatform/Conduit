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

    // This will replace the document in effect, if we wanted to simply patch the document
    // then wee need to add "true" in the updateProvidedOnly argument
    let updated = await this.grpcSdk.databaseProvider!.findByIdAndUpdate(
      'Stuff',
      params.id,
      { ...params.supplier }
    );

    return callback(null, { result: JSON.stringify({ ...updated }) });
  }

  async updatePartOfStuff(call: any, callback: any) {
    let params = JSON.parse(call.request.params);
    params.populate = populateArray(params.populate);

    if (!params.id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'id is required' });
    }
    if (!params.stuff) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'stuff is required',
      });
    }
    // This will only update provided fields
    let updated = await this.grpcSdk.databaseProvider!.findByIdAndUpdate(
      'Stuff',
      params.id,
      { ...params.stuff },
      true
    );
    return callback(null, { result: JSON.stringify({ ...updated }) });
  }

  async createStuff(call: any, callback: any) {
    let params = JSON.parse(call.request.params);
    params.populate = populateArray(params.populate);

    if (!params.id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'id is required' });
    }
    if (!params.stuff) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'stuff is required',
      });
    }

    let created = await this.grpcSdk.databaseProvider!.create('Stuff', {
      ...params.stuff,
    });
    return callback(null, { result: JSON.stringify({ ...created }) });
  }

  async deleteStuff(call: any, callback: any) {
    let params = JSON.parse(call.request.params);
    if (!params.id) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'id is required' });
    }
    let stuff = await this.grpcSdk.databaseProvider!.findOne('Stuff', {
      _id: params.id,
    });

    if (!stuff) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Stuff not found' });
    }

    await this.grpcSdk.databaseProvider!.deleteOne('Stuff', { _id: params.id });

    return callback(null, { result: 'Done' });
  }
}
