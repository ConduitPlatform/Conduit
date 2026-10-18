import {
  ConduitGrpcSdk,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { AuthUtils } from '../utils/index.js';
import { assertEmailAllowed } from '../utils/emailRestrictions.js';
import { isNil } from 'lodash-es';
import { RealmMembership, User } from '../models/index.js';
import escapeStringRegexp from 'escape-string-regexp';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { grantHomeMembership, homeRealmFields } from '../handlers/realmRequest.js';
import { realmsEnabled, resolveRealmById, withHomeScope } from '../utils/realm.js';

// Cap on the memberships loaded to resolve the `realm` filter next to other filters.
const MAX_MEMBERSHIP_FILTER = 1000;

export class UserAdmin {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async getUsers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { isActive, isAnonymous, provider, search, sort, homeRealm, realm } =
      call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    let query: Indexable = {};
    if (!isNil(isActive)) {
      query.active = isActive;
    }
    if (!isNil(isAnonymous)) {
      query.isAnonymous = isAnonymous;
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

    if (!isNil(homeRealm)) {
      // 'global' = users without a home realm, otherwise a realm team id
      query = withHomeScope(query, homeRealm === 'global' ? null : homeRealm);
    }
    if (!isNil(realm)) {
      // users that are members (home or guest) of the realm
      if (Object.keys(query).length === 0 && isNil(sort)) {
        // the realm is the only filter: page the memberships, then load those users
        const memberships = await RealmMembership.getInstance().findMany(
          { realm },
          { skip, limit, sort: { _id: 1 } },
        );
        const memberIds = memberships.map(membership => String(membership.user));
        const found = memberIds.length
          ? await User.getInstance().findMany({ _id: { $in: memberIds } })
          : [];
        const byId = new Map(found.map(user => [String(user._id), user]));
        const users = memberIds.flatMap(id => byId.get(id) ?? []);
        const count = await RealmMembership.getInstance().countDocuments({ realm });
        return { users, count };
      }
      // Combined with other filters the member ids are resolved first: only the first
      // MAX_MEMBERSHIP_FILTER memberships of the realm are considered.
      const memberships = await RealmMembership.getInstance().findMany(
        { realm },
        { limit: MAX_MEMBERSHIP_FILTER, sort: { _id: 1 } },
      );
      const memberIds = memberships.map(membership => String(membership.user));
      if (typeof query._id === 'string') {
        if (!memberIds.includes(query._id)) query._id = { $in: [] };
      } else {
        query._id = { $in: memberIds };
      }
    }

    const users: User[] = await User.getInstance().findMany(query, {
      skip,
      limit,
      sort,
    });
    const count: number = await User.getInstance().countDocuments(query);

    return { users, count };
  }

  async createUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { email, username, password, homeRealm } = call.request.params;

    const query = AuthUtils.validateAndNormalizeIdentifier(email, username);
    let realmCtx = null;
    if (!isNil(homeRealm) && homeRealm !== '') {
      if (!realmsEnabled()) throw new ModuleError(errors.REALMS_DISABLED);
      realmCtx = await resolveRealmById(String(homeRealm));
    }

    let user: User | null = await User.getInstance().findOne(query);
    if (!isNil(user)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'User already exists');
    }

    const hashedPassword = await AuthUtils.hashPassword(password);
    user = await User.getInstance().create({
      ...query,
      hashedPassword,
      isVerified: true,
      ...homeRealmFields(realmCtx),
    });
    try {
      await grantHomeMembership(this.grpcSdk, user, realmCtx);
    } catch (err) {
      // never leave a realm user without its membership
      await User.getInstance()
        .deleteOne({ _id: user._id })
        .catch(deleteErr => {
          ConduitGrpcSdk.Logger.error(deleteErr as Error);
        });
      throw err;
    }
    this.grpcSdk.bus?.publish('authentication:register:user', JSON.stringify(user));
    delete user.hashedPassword;
    return { user };
  }

  async patchUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, isVerified, hasTwoFA, phoneNumber } = call.request.params;
    const email = call.request.params.email.toLowerCase();

    const user: User | null = await User.getInstance().findOne({ _id: id });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    } else if (hasTwoFA && isNil(phoneNumber) && isNil(user.phoneNumber)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Can not enable 2fa without a phone number',
      );
    }
    if (user.email !== email) {
      const duplicateEmail: User | null = await User.getInstance().findOne({ email });
      if (!isNil(duplicateEmail)) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Email already exists');
      }
      assertEmailAllowed(email);
    }
    let twoFaMethod: string | undefined;
    if (hasTwoFA) {
      twoFaMethod = user.twoFaMethod ?? 'sms';
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
    user = await User.getInstance().findByIdAndUpdate(user._id, { active: false });
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
    user = await User.getInstance().findByIdAndUpdate(user._id, { active: true });
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
