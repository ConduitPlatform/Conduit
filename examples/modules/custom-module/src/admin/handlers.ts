import ConduitGrpcSdk, {
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
  DatabaseProvider,
} from '@quintessential-sft/conduit-grpc-sdk';
import { Foobar, User } from '../models';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import escapeStringRegexp from 'escape-string-regexp';

export class AdminHandlers {
  private readonly database: DatabaseProvider;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.database = this.grpcSdk.databaseProvider!;
  }

  async getFoobar(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    console.log('Called admin getFoobar() handler');
    const requestedFoobar = await Foobar.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (!requestedFoobar) {
      throw new GrpcError(status.NOT_FOUND, 'Foobar does not exist');
    }
    return requestedFoobar;
  }

  async getFoobars(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    console.log('Called admin getFoobars() handler');
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

  async createFoobar(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    console.log('Called admin createFoobar() handler');
    const {
      foo,
      bar,
      userId,
    } = call.request.params;
    const foobar = { foo, bar, userId };
    const userExists = await User.getInstance()
      .findOne({ _id: userId })
      .catch((e) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (!userExists) {
      throw new GrpcError(status.ALREADY_EXISTS, 'User does not exist');
    }
    // Uncomment this to assert that Foobar:User schemas are a 1:1 relationship
    // const foobarExists = await Foobar.getInstance()
    //   .findOne({ userId: call.request.params.userId })
    //   .catch((e) => { throw new GrpcError(status.INTERNAL, e.message); });
    // if (!foobarExists) {
    //   throw new GrpcError(status.ALREADY_EXISTS, 'Foobar already exists for target userId');
    // }
    return Foobar.getInstance()
      .create(foobar)
      .catch((e) => { throw new GrpcError(status.INTERNAL, e.message); });
  }

  async patchFoobar(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    console.log('Called admin patchFoobar() handler');
    const foobar = await Foobar.getInstance().findOne({ _id: call.request.params.id });
    if (!foobar) {
      throw new GrpcError(status.NOT_FOUND, 'Foobar does not exist');
    }
    for (const key of ['foo', 'bar', 'userId']) {
      if (call.request.params[key]) {
        if (key === 'userId') {
          const userExists = await User.getInstance()
            .findOne({ _id: call.request.params.userId })
            .catch((e) => { throw new GrpcError(status.INTERNAL, e.message); });
          if (!userExists) {
            throw new GrpcError(status.ALREADY_EXISTS, 'User does not exist');
          }
        }
        // @ts-ignore
        foobar[key] = call.request.params[key];
      }
    }
    const patchedFoobar = await Foobar.getInstance()
      .findByIdAndUpdate(call.request.params.id, foobar)
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    return { patchedFoobar };
  }

  async updateFoobar(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    console.log('Called admin updateFoobar() handler');
    const foobar = await Foobar.getInstance().findOne({ _id: call.request.params.id });
    if (!foobar) {
      throw new GrpcError(status.NOT_FOUND, 'Foobar does not exist');
    }
    const userExists = await User.getInstance()
      .findOne({ _id: call.request.params.userId })
      .catch((e) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (!userExists) {
      throw new GrpcError(status.ALREADY_EXISTS, 'User does not exist');
    }
    (foobar as any).fields = {
      foo: call.request.params.foo,
      bar: call.request.params.bar,
      userId: call.request.params.userId,
    };
    const updatedFoobar = await Foobar.getInstance()
      .findByIdAndUpdate(call.request.params.id, foobar)
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    return { updatedFoobar };
  }

  async deleteFoobar(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    console.log('Called admin deleteFoobar() handler');
    const foobar: Foobar | null = await Foobar.getInstance().findOne({ _id: call.request.params.id });
    if (!foobar) {
      throw new GrpcError(status.NOT_FOUND, 'Foobar does not exist');
    }
    await Foobar.getInstance().deleteOne({ _id: call.request.params.id })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    return 'Foobar was deleted';
  }

  async deleteFoobars(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    console.log('Called admin deleteFoobars() handler');
    if (call.request.params.ids.length === 0) { // array check is required
      throw new GrpcError(status.INVALID_ARGUMENT, 'ids is required and must be a non-empty array');
    }
    const foobars = await Foobar.getInstance()
      .deleteMany({ _id: { $in: call.request.params.ids } })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    const count = (foobars as any).deletedCount;
    return { foobars, count };
  }
}
