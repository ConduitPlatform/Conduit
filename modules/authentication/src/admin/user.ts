import {
  ConduitGrpcSdk,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  Query,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { AuthUtils } from '../utils/index.js';
import { isNil } from 'lodash-es';
import {
  RealmMembership,
  Team,
  Token,
  TwoFactorBackUpCodes,
  TwoFactorSecret,
  User,
} from '../models/index.js';
import { toRealmRef } from '../handlers/realm.logic.js';
import { ConfigController, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { TokenProvider } from '../handlers/tokenProvider.js';
import { issuePasswordReset } from '../handlers/local.logic.js';
import { TokenType } from '../constants/index.js';
import { invalidateTeamClaims } from '../utils/teamClaims.js';
import {
  assertSortAllowed,
  buildUserAdminCapabilities,
  buildUserPatch,
  userFilterQuery,
} from './user.logic.js';
import {
  grantHomeMembership,
  homeRealmFields,
  realmIdOf,
} from '../handlers/realmRequest.js';
import {
  assertIdentifierFreeForUser,
  assertRealmPrincipalFree,
  deleteUserRealmMemberships,
  identifierQuery,
  identifierTakenForUser,
  IdentifierQuery,
  realmsEnabled,
  resolveRealmById,
  uniqueIdentifierQuery,
} from '../utils/realm.js';

/** The identifier of a validated `{ email }` or `{ username }` query. */
function identifierOf(query: Record<string, unknown>): IdentifierQuery {
  return 'email' in query
    ? identifierQuery('email', String(query.email))
    : identifierQuery('username', String(query.username));
}

// Cap on the memberships loaded to resolve the `realm` filter next to other filters.
const MAX_MEMBERSHIP_FILTER = 1000;

const PASSWORD_RESET_TOKEN_TYPES = [
  TokenType.PASSWORD_RESET_TOKEN,
  TokenType.TWO_FA_CHANGE_PASSWORD_TOKEN,
];

const EMAIL_CHANGE_TOKEN_TYPES = [
  TokenType.VERIFICATION_TOKEN,
  TokenType.CHANGE_EMAIL_TOKEN,
  TokenType.PASSWORD_RESET_TOKEN,
];

// users whose authorization relations are deleted in parallel
const RELATION_DELETE_CONCURRENCY = 20;

const TWO_FA_RESET_TOKEN_TYPES = [
  TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
  TokenType.AUTHENTICATOR_VERIFICATION_TOKEN,
];

/** A page of the members (home or guest) of a realm, in membership order. */
async function pageRealmMembers(realm: string, skip?: number, limit?: number) {
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

/**
 * Narrows `query` to the members of a realm. The member ids are resolved first: only the
 * first MAX_MEMBERSHIP_FILTER memberships of the realm are considered.
 */
async function restrictToRealmMembers(query: Indexable, realm: string): Promise<void> {
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

export class UserAdmin {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  /**
   * The home realm and the guest realms of a user. A guest realm carries the time the user was
   * linked into it. A realm whose team no longer exists is left out.
   */
  async getUserRealms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const user = await User.getInstance().findOne({ _id: id });
    if (!user) throw new ModuleError(errors.USER_NOT_FOUND);
    const homeId = user.homeRealm ? String(user.homeRealm) : null;
    const memberships = await RealmMembership.getInstance().findMany(
      { user: String(user._id), membershipType: 'guest' },
      { sort: { _id: 1 } },
    );
    const realmIds = [
      ...new Set([homeId, ...memberships.map(membership => String(membership.realm))]),
    ].filter((realmId): realmId is string => !!realmId);
    const teams = realmIds.length
      ? await Team.getInstance().findMany({ _id: { $in: realmIds } })
      : [];
    const byId = new Map(teams.map(team => [String(team._id), team]));
    const homeTeam = homeId ? byId.get(homeId) : undefined;
    const home = homeTeam ? toRealmRef(homeTeam) : null;
    const guests = memberships.flatMap(membership => {
      const realmId = String(membership.realm);
      const team = byId.get(realmId);
      if (!team || realmId === homeId) return [];
      return [{ ...toRealmRef(team), createdAt: membership.createdAt }];
    });
    return { home, guests };
  }

  /**
   * Set by the admin router when it registers `/users/:id/password-reset`, so the
   * capabilities never advertise a route that is not there.
   */
  passwordResetRouteRegistered = false;

  async getUserCapabilities(): Promise<UnparsedRouterResponse> {
    const config = ConfigController.getInstance().config;
    const teamsEnabled = Boolean(
      config.teams?.enabled && this.grpcSdk.isAvailable('authorization'),
    );
    return buildUserAdminCapabilities({
      emailAvailable:
        this.passwordResetRouteRegistered && this.grpcSdk.isAvailable('email'),
      teamsEnabled,
    });
  }

  /**
   * Deletes the authorization relations held by or on the users. Best effort: the users
   * are already gone and cannot be deleted again to retry, so failures are logged and
   * the remaining cleanup still runs.
   */
  private async deleteUserRelations(userIds: string[]): Promise<void> {
    const authorization = this.grpcSdk.authorization;
    if (!authorization) {
      ConduitGrpcSdk.Logger.warn(
        `Authorization is not available: relations of deleted users ${userIds.join(', ')} were not removed`,
      );
      return;
    }
    for (let i = 0; i < userIds.length; i += RELATION_DELETE_CONCURRENCY) {
      const chunk = userIds.slice(i, i + RELATION_DELETE_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.flatMap(id => [
          authorization.deleteAllRelations({ resource: 'User:' + id }),
          authorization.deleteAllRelations({ subject: 'User:' + id }),
        ]),
      );
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          ConduitGrpcSdk.Logger.error(
            `Failed to delete authorization relations of user ${chunk[Math.floor(index / 2)]}: ${result.reason}`,
          );
        }
      });
    }
  }

  async getUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    // `GET /users/capabilities` shares this pattern: answer it here as well in case the
    // router matches `/users/:id` first
    if (id === 'capabilities') return this.getUserCapabilities();
    const user: User | null = await User.getInstance().findOne({ _id: id });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }
    return user;
  }

  async getUsers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort, realm } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    assertSortAllowed(sort);

    const query = userFilterQuery(call.request.params);
    if (!isNil(realm)) {
      // users that are members (home or guest) of the realm
      if (Object.keys(query).length === 0 && isNil(sort)) {
        // the realm is the only filter: page the memberships, then load those users
        return pageRealmMembers(realm, skip, limit);
      }
      await restrictToRealmMembers(query, realm);
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

    // isolated mode: the identifier only has to be free under the new user's home realm
    let user: User | null = await User.getInstance().findOne(
      uniqueIdentifierQuery(query, realmIdOf(realmCtx)),
    );
    if (!isNil(user)) {
      throw new ModuleError(errors.USER_EXISTS);
    }

    if (realmCtx) {
      // a linked guest of the realm holding one of the identifiers is a principal there too
      await assertRealmPrincipalFree(realmIdOf(realmCtx), [identifierOf(query)], {
        conflict: 'USER_EXISTS',
      });
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
    const params = call.request.params;
    const user: User | null = await User.getInstance().findOne({ _id: params.id });
    if (isNil(user)) {
      throw new ModuleError(errors.USER_NOT_FOUND);
    }
    const wantsAuthenticator =
      params.hasTwoFA !== false && params.twoFaMethod === 'authenticator';
    const secret = wantsAuthenticator
      ? await TwoFactorSecret.getInstance().findOne({ user: user._id })
      : null;
    const { update, emailChanged } = buildUserPatch(user, params, {
      authenticatorSecret: !isNil(secret),
    });
    if (emailChanged) {
      // isolated mode: scoped to the target user's home realm and to the realms the user is
      // linked into as a guest
      if (
        await identifierTakenForUser(user, identifierQuery('email', String(update.email)))
      ) {
        throw new ModuleError(errors.USER_EMAIL_TAKEN);
      }
    }
    if (typeof update.phoneNumber === 'string') {
      await assertIdentifierFreeForUser(
        user,
        identifierQuery('phoneNumber', update.phoneNumber),
        errors.PHONE_NUMBER_TAKEN,
      );
    }

    const res: User | null = await User.getInstance().findByIdAndUpdate(
      user._id,
      update as Query<User>,
    );
    if (emailChanged) {
      await Token.getInstance().deleteMany({
        user: user._id,
        tokenType: { $in: EMAIL_CHANGE_TOKEN_TYPES },
      });
    }
    this.grpcSdk.bus?.publish('authentication:update:user', JSON.stringify(res));
    return { res };
  }

  async setPassword(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, password, revokeSessions } = call.request.params;
    if (typeof password !== 'string' || password.length < 8) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Password must be at least 8 characters',
      );
    }
    const user: User | null = await User.getInstance().findOne(
      { _id: id },
      { select: '+hashedPassword' },
    );
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }
    if (user.isAnonymous) {
      throw new GrpcError(status.FAILED_PRECONDITION, 'Anonymous user');
    }
    if (isNil(user.hashedPassword)) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        'User does not use password authentication',
      );
    }
    const hashedPassword = await AuthUtils.hashPassword(password);
    const updated: User | null = await User.getInstance().findByIdAndUpdate(user._id, {
      hashedPassword,
    });
    await Token.getInstance().deleteMany({
      user: user._id,
      tokenType: { $in: PASSWORD_RESET_TOKEN_TYPES },
    });
    if (revokeSessions !== false) {
      await TokenProvider.getInstance().deleteUserTokens({ user: String(user._id) });
      TokenProvider.getInstance().trackLoggedOutUserMetric(String(user._id));
    }
    if (updated) {
      const published = { ...updated };
      delete published.hashedPassword;
      this.grpcSdk.bus?.publish('authentication:update:user', JSON.stringify(published));
    }
    return 'Password updated';
  }

  async sendPasswordReset(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const user: User | null = await User.getInstance().findOne(
      { _id: id },
      { select: '+hashedPassword' },
    );
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }
    const redirectUri =
      AuthUtils.validateRedirectUri(call.request.params.redirectUri) ??
      ConfigController.getInstance().config.local?.forgot_password_redirect_uri ??
      '';
    await issuePasswordReset(this.grpcSdk, user, redirectUri);
    return 'Password reset email sent';
  }

  async resetTwoFa(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, revokeSessions } = call.request.params;
    const user: User | null = await User.getInstance().findOne({ _id: id });
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }
    await User.getInstance().findByIdAndUpdate(user._id, {
      hasTwoFA: false,
      twoFaMethod: null,
    } as Query<User>);
    await TwoFactorSecret.getInstance().deleteMany({ user: user._id });
    await TwoFactorBackUpCodes.getInstance().deleteMany({ user: user._id });
    await Token.getInstance().deleteMany({
      user: user._id,
      tokenType: { $in: TWO_FA_RESET_TOKEN_TYPES },
    });
    if (revokeSessions === true) {
      await TokenProvider.getInstance().deleteUserTokens({ user: String(user._id) });
      TokenProvider.getInstance().trackLoggedOutUserMetric(String(user._id));
    }
    this.grpcSdk.bus?.publish(
      'authentication:disableTwofa:user',
      JSON.stringify({ id: user._id }),
    );
    return '2FA reset';
  }

  async deleteUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const user: User | null = await User.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(user)) {
      throw new ModuleError(errors.USER_NOT_FOUND);
    }
    const res = await this.grpcSdk.database!.withOptionalTransaction(async db => {
      const deleted = await User.getInstance().deleteOne(
        { _id: call.request.params.id },
        { transaction: db },
      );
      await deleteUserRealmMemberships(String(user._id), db);
      return deleted;
    });
    // no session may outlive its user: revoke before anything else can fail
    await TokenProvider.getInstance().deleteUserTokens({ user: String(user._id) });
    TokenProvider.getInstance().trackLoggedOutUserMetric(String(user._id));
    await this.deleteUserRelations([String(user._id)]);
    await invalidateTeamClaims([String(user._id)]);
    this.grpcSdk.bus?.publish('authentication:delete:user', JSON.stringify(res));
    return 'User was deleted';
  }

  async deleteUsers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids } = call.request.params;
    if (ids.length === 0) {
      // array check is required
      throw new ModuleError(errors.USER_IDS_REQUIRED);
    }

    if (ids.length > 100) {
      ConduitGrpcSdk.Logger.warn(`Bulk delete of ${ids.length} users exceeds 100`);
    }
    const users: User[] = await User.getInstance().findMany({ _id: { $in: ids } });
    if (users.length === 0) {
      throw new ModuleError(errors.USER_NOT_FOUND);
    }

    const deletedIds = users.map(u => String(u._id));
    await this.grpcSdk.database!.withOptionalTransaction(async db => {
      await User.getInstance().deleteMany({ _id: { $in: ids } }, { transaction: db });
      await deleteUserRealmMemberships(deletedIds, db);
    });
    // no session may outlive its user: revoke before anything else can fail
    await TokenProvider.getInstance().deleteUserTokens({ user: { $in: deletedIds } });
    deletedIds.forEach(id => TokenProvider.getInstance().trackLoggedOutUserMetric(id));
    await this.deleteUserRelations(deletedIds);
    await invalidateTeamClaims(deletedIds);
    this.grpcSdk.bus?.publish('authentication:delete:user', JSON.stringify(users));
    return 'Users were deleted';
  }

  async blockUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let user: User | null = await User.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(user)) {
      throw new ModuleError(errors.USER_NOT_FOUND);
    }
    if (!user.active) {
      throw new ModuleError(errors.USER_ALREADY_BLOCKED);
    }
    user = await User.getInstance().findByIdAndUpdate(user._id, { active: false });
    // a blocked user's sessions end (same as the userModifyStatus rpc)
    await TokenProvider.getInstance().deleteUserTokens({
      user: String(call.request.params.id),
    });
    TokenProvider.getInstance().trackLoggedOutUserMetric(String(call.request.params.id));
    this.grpcSdk.bus?.publish('authentication:block:user', JSON.stringify(user));
    return 'User was blocked';
  }

  async unblockUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let user: User | null = await User.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(user)) {
      throw new ModuleError(errors.USER_NOT_FOUND);
    }
    if (user.active) {
      throw new ModuleError(errors.USER_ALREADY_ACTIVE);
    }
    user = await User.getInstance().findByIdAndUpdate(user._id, { active: true });
    this.grpcSdk.bus?.publish('authentication:unblock:user', JSON.stringify(user));
    return 'User was unblocked';
  }

  async toggleUsers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids, block } = call.request.params;
    if (ids.length === 0) {
      // array check is required
      throw new ModuleError(errors.USER_IDS_REQUIRED);
    }
    const users: User[] | null = await User.getInstance().findMany({ _id: { $in: ids } });
    if (users.length === 0) {
      throw new ModuleError(errors.USER_NOT_FOUND);
    }
    const active = !block;
    const changed = users.filter(user => user.active !== active);
    const changedIds = changed.map(user => String(user._id));
    if (changedIds.length > 0) {
      await User.getInstance().updateMany({ _id: { $in: changedIds } }, { active });
    }
    if (block) {
      // every blocked user is signed out, including one already inactive whose
      // sessions survived an earlier path
      const blockedIds = users.map(user => String(user._id));
      await TokenProvider.getInstance().deleteUserTokens({
        user: { $in: blockedIds },
      });
      blockedIds.forEach(id => TokenProvider.getInstance().trackLoggedOutUserMetric(id));
      this.grpcSdk.bus?.publish('authentication:block:user', JSON.stringify(changed));
      return 'Users were blocked';
    }
    this.grpcSdk.bus?.publish('authentication:unblock:user', JSON.stringify(changed));
    return 'Users were unblocked';
  }
}
