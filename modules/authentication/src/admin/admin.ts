import ConduitGrpcSdk, {
  DatabaseProvider,
  GrpcError,
  GrpcServer,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { ServiceAdmin } from './service';
import { ConfigController } from '../config/Config.controller';
import { AuthUtils } from '../utils/auth';
import { User } from '../models';

let paths = require('./admin.json').functions;
const escapeStringRegexp = require('escape-string-regexp');

export class AdminHandlers {
  private database: DatabaseProvider;

  constructor(server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = self.grpcSdk.databaseProvider!;
    });
    let serviceAdmin = new ServiceAdmin(this.grpcSdk);
    this.grpcSdk.admin
      .registerAdminAsync(server, paths, {
        getUsers: this.getUsers.bind(this),
        createUser: this.createUser.bind(this),
        editUser: this.editUser.bind(this),
        deleteUser: this.deleteUser.bind(this),
        deleteUsers: this.deleteUsers.bind(this),
        blockUnblockUsers: this.blockUnblockUsers.bind(this),
        blockUser: this.blockUser.bind(this),
        unblockUser: this.unblockUser.bind(this),
        getServices: serviceAdmin.getServices.bind(serviceAdmin),
        createService: serviceAdmin.createService.bind(serviceAdmin),
        deleteService: serviceAdmin.deleteService.bind(serviceAdmin),
        renewServiceToken: serviceAdmin.renewToken.bind(serviceAdmin),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  async getUsers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, isActive, provider, search, sort } = call.request.params;
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

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
    let identifier;
    if (!isNil(search)) {
      if (search.match(/^[a-fA-F0-9]{24}$/)) {
        query = { _id : search }
      }
      else {
        identifier = escapeStringRegexp(search);
        query['email'] = { $regex: `.*${identifier}.*`, $options: 'i' };
      }
    }

    const users: User[] = await User.getInstance().findMany(
      query,
      undefined,
      skipNumber,
      limitNumber,
      sort
    );
    const count: number = await User.getInstance().countDocuments(query);

    return { users, count };
  }

  async createUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let { identification, password } = call.request.params;

    if (isNil(identification) || isNil(password)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Identification and password are required'
      );
    }

    const config = ConfigController.getInstance().config;
    if (config.local.identifier === 'email') {
      if (identification.indexOf('+') !== -1) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          'Email contains unsupported characters'
        );
      }

      identification = identification.toLowerCase();
    }

    let user: User | null = await User.getInstance().findOne({
      email: identification,
    });
    if (!isNil(user)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'User already exists');
    }

    let hashedPassword = await AuthUtils.hashPassword(password);
    user = await User.getInstance().create({
      email: identification,
      hashedPassword,
      isVerified: true,
    });
    this.grpcSdk.bus?.publish('authentication:register:user', JSON.stringify(user));
    return { message: 'Registration was successful' };
  }

  async editUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, email, isVerified, hasTwoFA, phoneNumber } = call.request.params;
    if (isNil(id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'id is required');
    }

    let user: User | null = await User.getInstance().findOne({ _id: id });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    } else if (hasTwoFA && isNil(phoneNumber) && isNil(user.phoneNumber)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Can not enable 2fa without a phone number'
      );
    }

    const query = {
      email: email ?? user.email,
      isVerified: isVerified ?? user.isVerified,
      hasTwoFA: hasTwoFA ?? user.hasTwoFA,
      phoneNumber: phoneNumber ?? user.phoneNumber,
    };

    let res: User | null = await User.getInstance().findByIdAndUpdate(user._id, query);
    this.grpcSdk.bus?.publish('authentication:update:user', JSON.stringify(res));
    return { message: 'user updated' };
  }

  async deleteUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;

    if (isNil(id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'id is required');
    }

    let user: User | null = await User.getInstance().findOne({ _id: id });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }

    let res = await User.getInstance().deleteOne({ _id: id });
    this.grpcSdk.bus?.publish('authentication:delete:user', JSON.stringify(res));
    return { message: 'user was deleted' };
  }

  async deleteUsers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;

    if (isNil(ids) || ids.length === 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'ids is required and must be an array'
      );
    }

    let users: User[] = await User.getInstance().findMany({ _id: { $in: ids } });
    if (users.length === 0) {
      throw new GrpcError(status.NOT_FOUND, 'Users do not exist');
    }

    let res = await User.getInstance().deleteMany({ _id: { $in: ids } });
    this.grpcSdk.bus?.publish('authentication:delete:user', JSON.stringify(res));
    return { message: 'users were deleted' };
  }

  async blockUnblockUsers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids, block } = call.request.params;

    if (isNil(ids) || ids.length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'ids is required');
    }
    if (isNil(block)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Block is required');
    }
    let users: User[] | null = await User.getInstance().findMany({ _id: { $in: ids } });

    if (users.length === 0) {
      throw new GrpcError(status.NOT_FOUND, 'Users do not exist');
    }
    await User.getInstance().updateMany({ _id: { $in: ids } }, { active: block }, true);
    this.grpcSdk.bus?.publish('authentication:block:user', JSON.stringify(users));
    return { message: 'users were blocked' };
  }

  async blockUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;

    if (isNil(id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'id is required');
    }
    let user: User | null = await User.getInstance().findOne({ _id: id });

    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    } else if (!user.active) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'User is already blocked');
    }

    user.active = false;
    user = await User.getInstance().findByIdAndUpdate(user._id, user);
    this.grpcSdk.bus?.publish('authentication:block:user', JSON.stringify(user));
    return { message: 'user was blocked' };
  }

  async unblockUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;

    if (isNil(id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'id is required');
    }

    let user: User | null = await User.getInstance().findOne({ _id: id });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }

    if (user.active) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'user is not blocked');
    }

    user.active = true;
    user = await User.getInstance().findByIdAndUpdate(user._id, user);
    this.grpcSdk.bus?.publish('authentication:unblock:user', JSON.stringify(user));
    return { message: 'user was unblocked' };
  }
}
