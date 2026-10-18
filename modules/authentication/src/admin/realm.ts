import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitJson,
  ConduitNumber,
  ConduitObjectId,
  ConduitString,
  ModuleError,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import escapeStringRegexp from 'escape-string-regexp';
import { isNil } from 'lodash-es';
import { REALM_UPDATE_EVENT } from '../constants/index.js';
import { errors } from '../errors.js';
import {
  AccessToken,
  RealmMembership,
  RealmSettings,
  RefreshToken,
  Team,
  User,
} from '../models/index.js';
import {
  assertNoNestedRealm,
  assertSlugAvailable,
  assertSlugUniqueAfterWrite,
  assertValidSlug,
  defaultRealmSettings,
  evaluateGuestAllowed,
  grantRealmMembership,
  invalidateRealmCache,
  realmsEnabled,
  revokeRealmMembership,
} from '../utils/realm.js';
import {
  assertRealmTeamIds,
  collectTeamSubtreeIds,
  collectTeamUserIds,
  revokeRealmlessTokens,
} from '../utils/teamRealm.js';
import {
  buildRealmSettingsWrite,
  DEMOTE_STEPS,
  DemoteStep,
  guestsNotAllowedError,
  planOldHomeMembership,
  planPromoteMembers,
  PromotePlan,
  resolveSlugChange,
  toRealmDto,
  toRealmMember,
} from './realm.logic.js';

const BATCH_SIZE = 100;

function chunk<T>(items: T[], size: number = BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

const realmErrors = {
  notFound: errors.REALM_NOT_FOUND,
  disabled: errors.REALMS_DISABLED,
};

export class RealmsAdmin {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    /** runs on this replica after a realm write (the bus skips the publisher) */
    private readonly onRealmChange?: () => void,
  ) {}

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/realms',
        action: ConduitRouteActions.GET,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
        },
        name: 'GetRealms',
        description: 'Lists realm teams with their settings (secrets masked) and counts.',
      },
      new ConduitRouteReturnDefinition('GetRealms', {
        realms: { type: [TYPE.JSON], required: true },
        count: ConduitNumber.Required,
      }),
      this.getRealms.bind(this),
    );
    routingManager.route(
      {
        path: '/realms/:teamId',
        action: ConduitRouteActions.GET,
        urlParams: { teamId: ConduitObjectId.Required },
        errors: [errors.REALM_NOT_FOUND],
        name: 'GetRealm',
        description: 'Gets a realm: its team, settings (secrets masked) and counts.',
      },
      new ConduitRouteReturnDefinition('Realm', {
        team: ConduitJson.Required,
        settings: ConduitJson.Required,
        counts: { home: ConduitNumber.Required, guest: ConduitNumber.Required },
      }),
      this.getRealm.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/realm',
        action: ConduitRouteActions.POST,
        urlParams: { teamId: ConduitObjectId.Required },
        bodyParams: {
          slug: ConduitString.Required,
          active: ConduitBoolean.Optional,
          strategies: ConduitJson.Optional,
          policies: ConduitJson.Optional,
          registration: ConduitJson.Optional,
        },
        errors: [
          errors.REALMS_DISABLED,
          errors.REALM_SLUG_TAKEN,
          errors.REALM_NESTED,
          errors.GUESTS_NOT_ALLOWED,
        ],
        name: 'PromoteTeamToRealm',
        description:
          'Turns a top-level team into a realm. Existing members become home users, ' +
          'or guests when they already belong to another realm.',
      },
      new ConduitRouteReturnDefinition('PromoteTeamToRealm', {
        team: ConduitJson.Required,
        settings: ConduitJson.Required,
        counts: { home: ConduitNumber.Required, guest: ConduitNumber.Required },
      }),
      this.promote.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/realm',
        action: ConduitRouteActions.PATCH,
        urlParams: { teamId: ConduitObjectId.Required },
        bodyParams: {
          slug: ConduitString.Optional,
          force: ConduitBoolean.Optional,
          active: ConduitBoolean.Optional,
          strategies: ConduitJson.Optional,
          policies: ConduitJson.Optional,
          registration: ConduitJson.Optional,
        },
        errors: [errors.REALMS_DISABLED, errors.REALM_NOT_FOUND, errors.REALM_SLUG_TAKEN],
        name: 'UpdateRealm',
        description:
          'Updates realm settings (deep merge, arrays replace). A credential sent as ' +
          'null is cleared so the provider inherits the global configuration again. ' +
          'Changing the slug needs force.',
      },
      new ConduitRouteReturnDefinition('UpdateRealm', {
        team: ConduitJson.Required,
        settings: ConduitJson.Required,
        counts: { home: ConduitNumber.Required, guest: ConduitNumber.Required },
      }),
      this.updateRealm.bind(this),
    );
    routingManager.route(
      {
        path: '/teams/:teamId/realm',
        action: ConduitRouteActions.DELETE,
        urlParams: { teamId: ConduitObjectId.Required },
        queryParams: { force: ConduitBoolean.Optional },
        errors: [errors.REALM_NOT_FOUND, errors.REALM_HAS_HOME_USERS],
        name: 'DemoteRealm',
        description:
          'Turns a realm back into a plain team. Refused while home users exist, ' +
          'unless forced, which blocks them and ends their sessions.',
      },
      new ConduitRouteReturnDefinition('DemoteRealm', {
        message: ConduitString.Required,
        blockedUsers: ConduitNumber.Required,
      }),
      this.demoteRealm.bind(this),
    );
    routingManager.route(
      {
        path: '/realms/:teamId/members',
        action: ConduitRouteActions.GET,
        urlParams: { teamId: ConduitObjectId.Required },
        queryParams: {
          type: ConduitString.Optional,
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
        },
        errors: [errors.REALM_NOT_FOUND],
        name: 'GetRealmMembers',
        description: 'Lists the home and guest users of a realm.',
      },
      new ConduitRouteReturnDefinition('GetRealmMembers', {
        members: [User.name],
        count: ConduitNumber.Required,
      }),
      this.getRealmMembers.bind(this),
    );
    routingManager.route(
      {
        path: '/realms/:teamId/guests',
        action: ConduitRouteActions.POST,
        urlParams: { teamId: ConduitObjectId.Required },
        bodyParams: { userIds: { type: [TYPE.ObjectId], required: true } },
        errors: [
          errors.REALMS_DISABLED,
          errors.REALM_NOT_FOUND,
          errors.GUESTS_NOT_ALLOWED,
        ],
        name: 'AddRealmGuests',
        description: 'Adds existing users to a realm as guests.',
      },
      new ConduitRouteReturnDefinition('AddRealmGuests', {
        added: ConduitNumber.Required,
      }),
      this.addGuests.bind(this),
    );
    routingManager.route(
      {
        path: '/realms/:teamId/guests/:userId',
        action: ConduitRouteActions.DELETE,
        urlParams: {
          teamId: ConduitObjectId.Required,
          userId: ConduitObjectId.Required,
        },
        errors: [errors.REALM_NOT_FOUND, errors.HOME_USER_REMOVAL],
        name: 'RemoveRealmGuest',
        description: 'Removes a guest from a realm and ends the sessions bound to it.',
      },
      new ConduitRouteReturnDefinition('RemoveRealmGuest', 'String'),
      this.removeGuest.bind(this),
    );
    routingManager.route(
      {
        path: '/users/:id/home-realm',
        action: ConduitRouteActions.POST,
        urlParams: { id: ConduitObjectId.Required },
        bodyParams: {
          // '' or 'global' moves the user to the global scope
          realmTeamId: ConduitString.Required,
          force: ConduitBoolean.Optional,
        },
        errors: [errors.REALMS_DISABLED, errors.REALM_NOT_FOUND],
        name: 'MoveUserHomeRealm',
        description:
          "Moves a user's home realm (an empty realmTeamId makes the user global). " +
          'force ends all sessions of the user.',
      },
      new ConduitRouteReturnDefinition('MoveUserHomeRealm', User.name),
      this.moveUserHomeRealm.bind(this),
    );
  }

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------

  private assertEnabled() {
    if (!realmsEnabled()) throw new ModuleError(realmErrors.disabled);
  }

  private async findRealmTeam(teamId: string): Promise<Team> {
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team?.realm?.enabled) throw new ModuleError(realmErrors.notFound);
    return team;
  }

  private loadSettings(teamId: string) {
    // oauthSecrets is select: false, the has* flags of the masked view need it
    return RealmSettings.getInstance().findOne(
      { team: teamId },
      { select: '+oauthSecrets' },
    );
  }

  private async countMembers(teamId: string) {
    const [home, guest] = await Promise.all([
      RealmMembership.getInstance().countDocuments({
        realm: teamId,
        membershipType: 'home',
      }),
      RealmMembership.getInstance().countDocuments({
        realm: teamId,
        membershipType: 'guest',
      }),
    ]);
    return { home, guest };
  }

  /** Contract `Realm`. `settings` undefined = load them, null = the realm has none. */
  private async buildRealm(team: Team, settings?: RealmSettings | null) {
    const stored =
      settings === undefined ? await this.loadSettings(String(team._id)) : settings;
    const counts = await this.countMembers(String(team._id));
    return toRealmDto(
      team,
      stored ?? { ...defaultRealmSettings(), active: false, team: String(team._id) },
      counts,
    );
  }

  /** Every replica clears its realm cache and refreshes routes on this event. */
  private notifyRealmChange(teamId: string) {
    invalidateRealmCache();
    this.grpcSdk.bus?.publish(REALM_UPDATE_EVENT, JSON.stringify({ teamId }));
    this.onRealmChange?.();
  }

  private async findUsersByIds(ids: string[]): Promise<User[]> {
    const users: User[] = [];
    for (const batch of chunk(ids)) {
      users.push(...(await User.getInstance().findMany({ _id: { $in: batch } })));
    }
    return users;
  }

  private async hasRelationOn(userId: string, teamId: string): Promise<boolean> {
    const found = await this.grpcSdk.authorization!.findRelation({
      subject: 'User:' + userId,
      resource: 'Team:' + teamId,
      limit: 1,
    });
    return !!found && found.relations.length > 0;
  }

  /** Drops a user's relations on the realm team and everything below it. */
  private async removeRelationsInRealm(userId: string, realmTeamId: string) {
    for (const teamId of await collectTeamSubtreeIds(realmTeamId)) {
      try {
        await this.grpcSdk.authorization!.deleteAllRelations({
          subject: 'User:' + userId,
          resource: 'Team:' + teamId,
        });
      } catch {
        // authorization throws when no relation exists
      }
    }
  }

  /** Ids of the users whose id, email or username matches the search text (capped). */
  private async findUserIdsBySearch(search: string): Promise<string[]> {
    if (search.match(/^[a-fA-F0-9]{24}$/)) return [search];
    const pattern = { $regex: `.*${escapeStringRegexp(search)}.*`, $options: 'i' };
    const matches = await User.getInstance().findMany(
      { $or: [{ email: pattern }, { username: pattern }] },
      { limit: 1000 },
    );
    return matches.map(user => String(user._id));
  }

  // -------------------------------------------------------------------------
  // reads
  // -------------------------------------------------------------------------

  async getRealms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort } = call.request.params;
    const skip = call.request.params.skip ?? 0;
    const limit = call.request.params.limit ?? 25;

    const query: Indexable = { 'realm.enabled': true };
    if (!isNil(search) && search !== '') {
      const pattern = { $regex: `.*${escapeStringRegexp(search)}.*`, $options: 'i' };
      query['$or'] = [{ name: pattern }, { 'realm.slug': pattern }];
    }
    const teams = await Team.getInstance().findMany(query, { skip, limit, sort });
    const count = await Team.getInstance().countDocuments(query);
    const settings =
      teams.length > 0
        ? await RealmSettings.getInstance().findMany(
            { team: { $in: teams.map(team => String(team._id)) } },
            { select: '+oauthSecrets' },
          )
        : [];
    const settingsByTeam = new Map(settings.map(item => [String(item.team), item]));
    const realms = await Promise.all(
      teams.map(team =>
        this.buildRealm(team, settingsByTeam.get(String(team._id)) ?? null),
      ),
    );
    return { realms, count };
  }

  async getRealm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const team = await this.findRealmTeam(call.request.params.teamId);
    return this.buildRealm(team);
  }

  async getRealmMembers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId, type, search, sort } = call.request.params;
    const skip = call.request.params.skip ?? 0;
    const limit = call.request.params.limit ?? 25;
    if (!isNil(type) && type !== '' && type !== 'home' && type !== 'guest') {
      throw new GrpcError(status.INVALID_ARGUMENT, "type must be 'home' or 'guest'");
    }
    await this.findRealmTeam(teamId);

    const membershipQuery: Indexable = { realm: teamId };
    if (type === 'home' || type === 'guest') membershipQuery.membershipType = type;
    if (!isNil(search) && search !== '') {
      // narrow by user first, then page through the memberships of the matches
      const matchedIds = await this.findUserIdsBySearch(search);
      if (matchedIds.length === 0) return { members: [], count: 0 };
      membershipQuery.user = { $in: matchedIds };
    }
    // memberships are paged (a realm can have many users); `sort` applies to them, so
    // only the membership timestamps are honoured and the default is newest first
    const membershipSort =
      typeof sort === 'string' && /^-?(createdAt|updatedAt)$/.test(sort)
        ? sort
        : '-createdAt';
    const memberships = await RealmMembership.getInstance().findMany(membershipQuery, {
      skip,
      limit,
      sort: membershipSort,
    });
    const count = await RealmMembership.getInstance().countDocuments(membershipQuery);
    const typeByUser = new Map(
      memberships.map(membership => [String(membership.user), membership.membershipType]),
    );
    const loaded = await this.findUsersByIds(Array.from(typeByUser.keys()));
    const usersById = new Map(loaded.map(user => [String(user._id), user]));
    const users = memberships
      .map(membership => usersById.get(String(membership.user)))
      .filter((user): user is User => !!user);
    const members = await Promise.all(
      users.map(async user => {
        const relations = await this.grpcSdk.authorization!.findRelation({
          subject: 'User:' + user._id,
          resource: 'Team:' + teamId,
          limit: 1,
        });
        return toRealmMember(
          user,
          relations?.relations[0]?.relation,
          typeByUser.get(String(user._id)),
        );
      }),
    );
    return { members, count };
  }

  // -------------------------------------------------------------------------
  // promote / update / demote
  // -------------------------------------------------------------------------

  async promote(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    this.assertEnabled();
    const params = call.request.params;
    const { teamId } = params;
    const team = await Team.getInstance().findOne({ _id: teamId });
    if (!team) throw new GrpcError(status.NOT_FOUND, 'Team does not exist');
    if (team.realm?.enabled) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Team is already a realm');
    }
    if (team.isDefault) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        'The default team cannot become a realm: new users are added to it. ' +
          'Make another team the default first.',
      );
    }
    await assertNoNestedRealm(teamId, undefined, { promote: true });
    const slug = assertValidSlug(params.slug);
    await assertSlugAvailable(slug, teamId);
    const { settings, oauthSecrets } = buildRealmSettingsWrite({
      base: defaultRealmSettings(),
      input: params,
    });
    await assertRealmTeamIds(settings.policies.guests.allowedHomeRealms, teamId);

    // decide what happens to the existing members before writing anything
    const teamIds = await collectTeamSubtreeIds(teamId);
    const memberIds = await collectTeamUserIds(this.grpcSdk, teamIds);
    const members = await this.findUsersByIds(memberIds);
    const plan = planPromoteMembers(members, teamId, settings.policies);
    if (plan.rejected.length > 0) throw guestsNotAllowedError(plan.rejected, 'promote');

    // leftovers of an earlier, half-demoted realm would trip the unique team index
    await RealmSettings.getInstance().deleteMany({ team: teamId });
    try {
      await RealmSettings.getInstance().create({
        team: teamId,
        ...settings,
        oauthSecrets,
      } as Indexable);
      await Team.getInstance().findByIdAndUpdate(teamId, {
        realm: { enabled: true, slug },
      });
      await assertSlugUniqueAfterWrite(slug, teamId);
      await this.convertMembers(teamId, plan);
    } catch (e) {
      await this.rollbackPromote(teamId, plan);
      this.notifyRealmChange(teamId);
      throw e;
    }
    this.notifyRealmChange(teamId);
    const promoted = await Team.getInstance().findOne({ _id: teamId });
    return this.buildRealm(promoted!);
  }

  /** Home users get the realm as home realm (if they had none) and a home membership. */
  private async convertMembers(teamId: string, plan: PromotePlan) {
    for (const batch of chunk(plan.setHomeRealm)) {
      await User.getInstance().updateMany({ _id: { $in: batch } }, { homeRealm: teamId });
      // their global sessions end with the move into the realm
      await revokeRealmlessTokens(batch);
    }
    // the authorization relations already exist, only the memberships are written
    for (const batch of chunk(plan.home, 25)) {
      await Promise.all(
        batch.map(userId =>
          grantRealmMembership(this.grpcSdk, {
            userId,
            realmTeamId: teamId,
            type: 'home',
          }),
        ),
      );
    }
    for (const batch of chunk(plan.guests, 25)) {
      await Promise.all(
        batch.map(userId =>
          grantRealmMembership(this.grpcSdk, {
            userId,
            realmTeamId: teamId,
            type: 'guest',
            // already judged by planPromoteMembers
            enforceGuestPolicy: false,
          }),
        ),
      );
    }
  }

  /** Best effort: never masks the error that triggered it. */
  private async rollbackPromote(teamId: string, plan: PromotePlan) {
    const steps: (() => Promise<unknown>)[] = [
      () => RealmMembership.getInstance().deleteMany({ realm: teamId }),
      async () => {
        for (const batch of chunk(plan.setHomeRealm)) {
          await User.getInstance().updateMany(
            { _id: { $in: batch }, homeRealm: teamId },
            { homeRealm: null },
          );
        }
      },
      () => Team.getInstance().findByIdAndUpdate(teamId, { realm: { enabled: false } }),
      () => RealmSettings.getInstance().deleteMany({ team: teamId }),
    ];
    for (const step of steps) {
      try {
        await step();
      } catch (e) {
        ConduitGrpcSdk.Logger.error(e as Error);
      }
    }
  }

  async updateRealm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    this.assertEnabled();
    const params = call.request.params;
    const { teamId } = params;
    const team = await this.findRealmTeam(teamId);
    const stored = await this.loadSettings(teamId);
    if (!stored) throw new ModuleError(realmErrors.notFound);

    const currentSlug = team.realm?.slug;
    const newSlug = resolveSlugChange(currentSlug, params.slug, params.force);
    const { settings, oauthSecrets } = buildRealmSettingsWrite({
      base: stored,
      baseSecrets: stored.oauthSecrets,
      input: params,
    });
    if (newSlug) {
      assertValidSlug(newSlug);
      await assertSlugAvailable(newSlug, teamId);
    }
    if (params.policies?.guests?.allowedHomeRealms !== undefined) {
      await assertRealmTeamIds(settings.policies.guests.allowedHomeRealms, teamId);
    }

    try {
      if (newSlug) {
        await Team.getInstance().findByIdAndUpdate(teamId, {
          realm: { enabled: true, slug: newSlug },
        });
        await assertSlugUniqueAfterWrite(newSlug, teamId);
      }
      await RealmSettings.getInstance().findByIdAndUpdate(stored._id, {
        active: settings.active,
        strategies: settings.strategies,
        registration: settings.registration,
        policies: settings.policies,
        oauthSecrets,
      } as Indexable);
    } catch (e) {
      if (newSlug) {
        await Team.getInstance()
          .findByIdAndUpdate(teamId, { realm: { enabled: true, slug: currentSlug } })
          .catch(err => ConduitGrpcSdk.Logger.error(err as Error));
      }
      this.notifyRealmChange(teamId);
      throw e;
    }
    this.notifyRealmChange(teamId);
    const updated = await Team.getInstance().findOne({ _id: teamId });
    return this.buildRealm(updated!);
  }

  async demoteRealm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId, force } = call.request.params;
    await this.findRealmTeam(teamId);

    const homeUserCount = await User.getInstance().countDocuments({ homeRealm: teamId });
    const homeMembershipCount = await RealmMembership.getInstance().countDocuments({
      realm: teamId,
      membershipType: 'home',
    });
    const homeUsers = Math.max(homeUserCount, homeMembershipCount);
    if (homeUsers > 0 && force !== true) {
      throw new ModuleError(errors.REALM_HAS_HOME_USERS);
    }

    let blockedUsers = 0;
    const steps: Record<DemoteStep, () => Promise<void>> = {
      // the home users cannot authenticate anywhere else: block them first
      blockHomeUsers: async () => {
        if (homeUsers === 0) return;
        const homeUserIds: string[] = [];
        const pageSize = 500;
        for (let skip = 0; ; skip += pageSize) {
          const page = await User.getInstance().findMany(
            { homeRealm: teamId },
            { skip, limit: pageSize },
          );
          homeUserIds.push(...page.map(user => String(user._id)));
          if (page.length < pageSize) break;
        }
        for (const batch of chunk(homeUserIds)) {
          await User.getInstance().updateMany({ _id: { $in: batch } }, { active: false });
          await Promise.all([
            AccessToken.getInstance().deleteMany({ user: { $in: batch } }),
            RefreshToken.getInstance().deleteMany({ user: { $in: batch } }),
          ]);
        }
        blockedUsers = homeUserIds.length;
      },
      deleteMemberships: async () => {
        await RealmMembership.getInstance().deleteMany({ realm: teamId });
      },
      deleteSettings: async () => {
        await RealmSettings.getInstance().deleteMany({ team: teamId });
      },
      // replaces the whole realm object: the slug is dropped with it
      flipTeam: async () => {
        await Team.getInstance().findByIdAndUpdate(teamId, { realm: { enabled: false } });
      },
      publish: async () => this.notifyRealmChange(teamId),
      // last: the realm no longer resolves, so no session can be minted after the sweep
      sweepRealmTokens: async () => {
        await Promise.all([
          AccessToken.getInstance().deleteMany({ realm: teamId }),
          RefreshToken.getInstance().deleteMany({ realm: teamId }),
        ]);
      },
    };
    for (const step of DEMOTE_STEPS) await steps[step]();
    return { message: 'Realm removed', blockedUsers };
  }

  // -------------------------------------------------------------------------
  // guests and home realm
  // -------------------------------------------------------------------------

  async addGuests(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    this.assertEnabled();
    const { teamId, userIds } = call.request.params;
    await this.findRealmTeam(teamId);
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'userIds is required and must be a non-empty array',
      );
    }
    const uniqueIds = Array.from(new Set<string>(userIds.map(String)));
    const users = await this.findUsersByIds(uniqueIds);
    if (users.length !== uniqueIds.length) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'userIds contains invalid user ids');
    }
    // home users are not guests of their own realm
    const candidates = users.filter(user => String(user.homeRealm ?? '') !== teamId);
    const existing = new Set<string>();
    for (const batch of chunk(candidates.map(user => String(user._id)))) {
      const found = await RealmMembership.getInstance().findMany({
        realm: teamId,
        user: { $in: batch },
      });
      found.forEach(membership => existing.add(String(membership.user)));
    }
    const toAdd = candidates.filter(user => !existing.has(String(user._id)));

    const settings = await RealmSettings.getInstance().findOne({ team: teamId });
    if (settings) {
      const rejected = toAdd.filter(
        user =>
          !evaluateGuestAllowed(
            settings.policies,
            user.homeRealm ? String(user.homeRealm) : null,
          ).allowed,
      );
      if (rejected.length > 0) throw guestsNotAllowedError(rejected, 'add');
    }
    for (const user of toAdd) {
      const userId = String(user._id);
      await grantRealmMembership(this.grpcSdk, {
        userId,
        realmTeamId: teamId,
        type: 'guest',
        // keep the role of a user who already holds a relation on the realm team
        role: (await this.hasRelationOn(userId, teamId)) ? undefined : 'member',
        enforceGuestPolicy: true,
      });
    }
    return { added: toAdd.length };
  }

  async removeGuest(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { teamId, userId } = call.request.params;
    await this.findRealmTeam(teamId);
    const user = await User.getInstance().findOne({ _id: userId });
    if (!user) throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    if (String(user.homeRealm ?? '') === teamId) {
      throw new ModuleError(errors.HOME_USER_REMOVAL);
    }
    // a home membership is refused by revokeRealmMembership as well
    await revokeRealmMembership(this.grpcSdk, {
      userId,
      realmTeamId: teamId,
      removeRelations: true,
    });
    await this.removeRelationsInRealm(userId, teamId);
    return 'OK';
  }

  async moveUserHomeRealm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    this.assertEnabled();
    const { id, realmTeamId, force } = call.request.params;
    const user = await User.getInstance().findOne({ _id: id });
    if (!user) throw new GrpcError(status.NOT_FOUND, 'User does not exist');

    const targetId: string | null =
      isNil(realmTeamId) || realmTeamId === '' || realmTeamId === 'global'
        ? null
        : String(realmTeamId);
    const oldId = user.homeRealm ? String(user.homeRealm) : null;
    if (targetId) await this.findRealmTeam(targetId);

    if (targetId !== oldId) {
      const userId = String(user._id);
      // judged before anything is written
      const oldPlan = oldId
        ? planOldHomeMembership(
            (await RealmSettings.getInstance().findOne({ team: oldId }))?.policies,
            targetId,
          )
        : null;
      if (targetId) await this.makeHomeMember(userId, targetId);
      await User.getInstance().findByIdAndUpdate(userId, { homeRealm: targetId });
      if (!oldId) {
        // a global user gets a home realm: their global sessions end
        await revokeRealmlessTokens([userId]);
      } else if (oldPlan === 'guest') {
        // the old realm keeps the user as a guest
        await RealmMembership.getInstance().updateMany(
          { user: userId, realm: oldId },
          { membershipType: 'guest' },
        );
      } else {
        await revokeRealmMembership(this.grpcSdk, {
          userId,
          realmTeamId: oldId,
          allowHome: true,
          removeRelations: true,
        });
        await this.removeRelationsInRealm(userId, oldId);
      }
    }
    if (force === true) {
      await Promise.all([
        AccessToken.getInstance().deleteMany({ user: String(user._id) }),
        RefreshToken.getInstance().deleteMany({ user: String(user._id) }),
      ]);
    }
    invalidateRealmCache();
    return (await User.getInstance().findOne({ _id: id }))!;
  }

  /** A guest of the realm is converted in place, anybody else gets a new membership. */
  private async makeHomeMember(userId: string, realmTeamId: string) {
    const membership = await RealmMembership.getInstance().findOne({
      user: userId,
      realm: realmTeamId,
    });
    if (membership) {
      if (membership.membershipType !== 'home') {
        await RealmMembership.getInstance().updateOne(
          { user: userId, realm: realmTeamId },
          { membershipType: 'home' },
        );
      }
      return;
    }
    await grantRealmMembership(this.grpcSdk, {
      userId,
      realmTeamId,
      type: 'home',
      role: (await this.hasRelationOn(userId, realmTeamId)) ? undefined : 'member',
    });
  }
}
