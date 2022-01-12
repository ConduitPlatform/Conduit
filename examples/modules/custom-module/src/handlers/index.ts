import {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { Foobar } from '../models';
import escapeStringRegexp from 'escape-string-regexp';

export class CustomModuleHandlers {
  async getFoobar(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    console.log('Called non-admin getFoobar() handler');
    const requestedFoobar = await Foobar.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(requestedFoobar)) {
      throw new GrpcError(status.NOT_FOUND, 'Foobar does not exist');
    }
    return requestedFoobar;
  }

  async getFoobars(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    console.log('Called non-admin getFoobars() handler');
    const { search, sort } = call.request.params;
    const skip = call.request.params.skip ?? 0;
    const limit = call.request.params.limit ?? 25;
    let identifier, query = {};
    if (!isNil(search)) {
      identifier = escapeStringRegexp(search);
      query = { $regex: `.*${identifier}.*`, $options: 'i' };
    }
    const foobarsPromise = Foobar.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort
    );
    const foobarsCountPromise = Foobar.getInstance().countDocuments(query);
    const [foobars, count] = await Promise.all([
      foobarsPromise,
      foobarsCountPromise,
    ]).catch((e) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    return { foobars, count };
  }
}
