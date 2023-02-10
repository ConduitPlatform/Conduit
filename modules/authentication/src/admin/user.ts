import ConduitGrpcSdk, {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { AuthUtils } from '../utils';
import { isNil } from 'lodash';
import { User } from '../models';
import escapeStringRegexp from 'escape-string-regexp';

export class UserAdmin {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async getUsers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { isActive, provider, search, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    let query: any = {};
    if (!isNil(isActive)) {
      query.active = isActive;
    }
    if (!isNil(provider)) {
      if (provider === 'local') {
        query['hashedPassword'] = { $exists: true, $ne: null };
      } else {
        query[provider] = { $exists: true, $ne: null };
      }
    }
    if (!isNil(search)) {
      if (search.match(/^[a-fA-F0-9]{24}$/)) {
        query = { _id: search };
      } else {
        const emailIdentifier = escapeStringRegexp(search);
        query['email'] = { $regex: `.*${emailIdentifier}.*`, $options: 'i' };
      }
    }

    const users: User[] = await User.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    const count: number = await User.getInstance().countDocuments(query);

    return { users, count };
  }

  async createUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { email, password } = call.request.params;
    if (AuthUtils.invalidEmailAddress(email)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid email address provided');
    }

    let user: User | null = await User.getInstance().findOne({
      email: email.toLowerCase(),
    });
    if (!isNil(user)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'User already exists');
    }

    const hashedPassword = await AuthUtils.hashPassword(password);
    user = await User.getInstance().create({
      email,
      hashedPassword,
      isVerified: true,
    });
    this.grpcSdk.bus?.publish('authentication:register:user', JSON.stringify(user));
    delete user.hashedPassword;
    return { user };
  }

  async patchUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, email, isVerified, hasTwoFA, phoneNumber } = call.request.params;

    const user: User | null = await User.getInstance().findOne({ _id: id });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    } else if (hasTwoFA && isNil(phoneNumber) && isNil(user.phoneNumber)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Can not enable 2fa without a phone number',
      );
    }
    let twoFaMethod: string | undefined;
    if (hasTwoFA) {
      twoFaMethod = user.twoFaMethod ?? 'phone';
    }
    const query = {
      email: email ?? user.email,
      isVerified: isVerified ?? user.isVerified,
      hasTwoFA: hasTwoFA ?? user.hasTwoFA,
      phoneNumber: phoneNumber ?? user.phoneNumber,
      twoFaMethod: twoFaMethod,
    };

    const res: User | null = await User.getInstance().findByIdAndUpdate(user._id, query);
    this.grpcSdk.bus?.publish('authentication:update:user', JSON.stringify(res));
    return { res };
  }

  async deleteUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const user: User | null = await User.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }
    const res = await User.getInstance().deleteOne({ _id: call.request.params.id });
    await this.grpcSdk.authorization!.deleteAllRelations({
      resource: 'User:' + user._id,
    });
    await this.grpcSdk.authorization!.deleteAllRelations({ subject: 'User:' + user._id });
    this.grpcSdk.bus?.publish('authentication:delete:user', JSON.stringify(res));
    return 'User was deleted';
  }

  async deleteUsers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;
    if (ids.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'ids is required and must be an non-empty array',
      );
    }

    const users: User[] = await User.getInstance().findMany({ _id: { $in: ids } });
    if (users.length === 0) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }

    const res = await User.getInstance().deleteMany({ _id: { $in: ids } });
    this.grpcSdk.bus?.publish('authentication:delete:user', JSON.stringify(res));
    return 'Users were deleted';
  }

  async blockUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let user: User | null = await User.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }
    if (!user.active) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'User is already blocked');
    }
    user.active = false;
    user = await User.getInstance().findByIdAndUpdate(user._id, user);
    this.grpcSdk.bus?.publish('authentication:block:user', JSON.stringify(user));
    return 'User was blocked';
  }

  async unblockUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let user: User | null = await User.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }
    if (user.active) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'user is not blocked');
    }
    user.active = true;
    user = await User.getInstance().findByIdAndUpdate(user._id, user);
    this.grpcSdk.bus?.publish('authentication:unblock:user', JSON.stringify(user));
    return 'User was unblocked';
  }

  async toggleUsers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids, block } = call.request.params;
    if (ids.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'ids is required and must be a non-empty array',
      );
    }
    const users: User[] | null = await User.getInstance().findMany({ _id: { $in: ids } });
    if (users.length === 0) {
      throw new GrpcError(status.NOT_FOUND, 'Users do not exist');
    }
    await User.getInstance().updateMany({ _id: { $in: ids } }, { active: block });
    if (block) {
      this.grpcSdk.bus?.publish('authentication:block:user', JSON.stringify(users));
      return 'Users were blocked';
    } else {
      this.grpcSdk.bus?.publish('authentication:unblock:user', JSON.stringify(users));
      return 'Users were unblocked';
    }
  }
}
