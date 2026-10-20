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
  ConduitString,
  ConfigController,
  ModuleError,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';
import { AUTH_CREDENTIALS, OAUTH_CALLBACK, TokenType } from '../constants/index.js';
import { errors } from '../errors.js';
import { RealmMembership, Token, User } from '../models/index.js';
import { hasConduitCode } from '../utils/common.logic.js';
import { collectTeamSubtreeIds } from '../utils/teamRealm.js';
import {
  evaluateLinkEligibility,
  getRealmSlugById,
  grantRealmMembership,
  identifierQueriesOf,
  isGlobalRealmScope,
  LinkInvite,
  realmPrincipalClash,
  realmsEnabled,
  RealmContext,
  RealmPolicies,
  resolveRealmById,
  resolveTeamRealm,
  revokeRealmMembership,
  tokenAssurance,
} from '../utils/realm.js';
import {
  buildRealmDiscovery,
  buildUserRealms,
  enterRealmTokenFlags,
  isLeaveRefused,
  linkSourceStillValid,
  RealmPolicySummary,
  RealmRef,
  selectLinkSource,
  subteamIdsOnLeave,
  summarizePolicies,
  toRealmRef,
} from './realm.logic.js';
import { consumeLinkProof, findLinkProof } from './realmDiscovery.js';
import { resolveRealmFromSlug } from './realmRequest.js';
import { TeamsHandler } from './team.js';
import { TokenProvider } from './tokenProvider.js';

const realmRouteErrors = [errors.REALMS_DISABLED, errors.REALM_NOT_FOUND];

/** Accounts read per email by discover; more home realms than this are not listed. */
const DISCOVER_MAX_HOLDERS = 50;

/** Client routes of the realms feature: discovery, own realms, entering a realm. */
export class RealmHandlers {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  declareRoutes(routingManager: RoutingManager): void {
    const config = ConfigController.getInstance().config;
    const authRouteMiddlewares = ['authMiddleware'];
    if (config.anonymousUsers) {
      authRouteMiddlewares.push('denyAnonymousMiddleware');
    }
    routingManager.route(
      {
        path: '/realms/:slug',
        action: ConduitRouteActions.GET,
        description: `Public description of a realm: its name, enabled login strategies and policy summary.`,
        urlParams: { slug: ConduitString.Required },
        rateLimit: OAUTH_CALLBACK,
        errors: realmRouteErrors,
      },
      new ConduitRouteReturnDefinition('RealmDiscovery', {
        name: ConduitString.Required,
        slug: ConduitString.Required,
        strategies: {
          local: ConduitBoolean.Required,
          username: ConduitBoolean.Required,
          magicLink: ConduitBoolean.Required,
          phone: ConduitBoolean.Required,
          metamask: ConduitBoolean.Required,
          biometric: ConduitBoolean.Required,
          oauth: { type: [TYPE.String], required: true },
        },
        policies: {
          requireTwoFa: ConduitBoolean.Required,
          requireVerifiedEmail: ConduitBoolean.Required,
          guestsAllowed: ConduitBoolean.Required,
        },
      }),
      this.getRealm.bind(this),
    );
    routingManager.route(
      {
        path: '/user/realms',
        action: ConduitRouteActions.GET,
        description: `Returns the home realm and the guest realms of the current user.`,
        middlewares: authRouteMiddlewares,
      },
      new ConduitRouteReturnDefinition('UserRealmsResponse', {
        home: {
          type: {
            team: {
              _id: ConduitString.Required,
              name: ConduitString.Required,
              slug: ConduitString.Required,
            },
          },
          required: false,
        },
        guests: [
          {
            team: {
              _id: ConduitString.Required,
              name: ConduitString.Required,
              slug: ConduitString.Required,
            },
            policies: {
              requireTwoFa: ConduitBoolean.Required,
              requireVerifiedEmail: ConduitBoolean.Required,
            },
          },
        ],
      }),
      this.getUserRealms.bind(this),
    );
    routingManager.route(
      {
        path: '/realms/:slug/enter',
        action: ConduitRouteActions.POST,
        description: `Issues tokens bound to a realm the user is a member of. Realm policies are enforced.`,
        urlParams: { slug: ConduitString.Required },
        middlewares: authRouteMiddlewares,
        errors: [
          ...realmRouteErrors,
          errors.REALM_ACCESS_DENIED,
          errors.TWO_FA_REQUIRED_FOR_REALM,
          errors.GUESTS_NOT_ALLOWED,
        ],
      },
      new ConduitRouteReturnDefinition('RealmEnterResponse', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.enterRealm.bind(this),
    );
    routingManager.route(
      {
        path: '/realms/:slug/link',
        action: ConduitRouteActions.POST,
        description: `Connects an account of another realm to this realm: the account becomes a guest of this realm and signs in here with its own credentials. The account is the one of the proof token (discovery login) for sourceRealm, or the authenticated session's account. Returns tokens bound to this realm.`,
        urlParams: { slug: ConduitString.Required },
        bodyParams: {
          proofToken: ConduitString.Optional,
          sourceRealm: ConduitString.Optional,
          invitationToken: ConduitString.Optional,
        },
        middlewares: ['authMiddleware?'],
        errors: [
          ...realmRouteErrors,
          errors.INVALID_LINK_PROOF,
          errors.LINKING_NOT_ALLOWED,
          errors.LINK_CONFLICT,
          errors.GUESTS_NOT_ALLOWED,
          errors.REALM_ACCESS_DENIED,
          errors.TWO_FA_REQUIRED_FOR_REALM,
          errors.INVITATION_REQUIRED,
          errors.INVALID_INVITATION,
        ],
        rateLimit: AUTH_CREDENTIALS,
      },
      new ConduitRouteReturnDefinition('RealmLinkResponse', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.linkRealm.bind(this),
    );
    routingManager.route(
      {
        path: '/user/realms/:slug',
        action: ConduitRouteActions.DELETE,
        description: `Leaves a guest realm: the membership of the user in it and its sessions and relations there are removed. A home realm cannot be left.`,
        urlParams: { slug: ConduitString.Required },
        middlewares: authRouteMiddlewares,
        errors: [...realmRouteErrors, errors.HOME_USER_REMOVAL],
      },
      new ConduitRouteReturnDefinition('RealmLeaveResponse', 'String'),
      this.leaveRealm.bind(this),
    );
    if (config.teams.realms?.allowEmailDiscovery) {
      routingManager.route(
        {
          path: '/realms/discover',
          action: ConduitRouteActions.POST,
          description: `Returns the home realms of the accounts with an email address: one slug per home realm, null for a global account. Several entries are possible in isolated identity mode.`,
          bodyParams: { email: ConduitString.Required },
          rateLimit: AUTH_CREDENTIALS,
          errors: [errors.REALMS_DISABLED],
        },
        new ConduitRouteReturnDefinition('RealmDiscoverResponse', {
          slugs: [ConduitString.Optional],
        }),
        this.discover.bind(this),
      );
    }
  }

  private async requireRealm(slug: unknown): Promise<RealmContext> {
    const ctx = await resolveRealmFromSlug(slug);
    if (!ctx) throw new ModuleError(errors.REALM_NOT_FOUND);
    return ctx;
  }

  async getRealm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const ctx = await this.requireRealm(call.request.params.slug);
    return buildRealmDiscovery(ctx.team, ctx.effective);
  }

  async getUserRealms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    if (!realmsEnabled()) return { home: null, guests: [] };

    const homeRealmId = user.homeRealm ? String(user.homeRealm) : null;
    const resolve = (realmId: string) =>
      resolveRealmById(realmId).catch(() => null as RealmContext | null);

    let home: { team: RealmRef } | null = null;
    if (homeRealmId) {
      const ctx = await resolve(homeRealmId);
      if (ctx) home = { team: toRealmRef(ctx.team) };
    }
    const memberships = await RealmMembership.getInstance().findMany({
      user: String(user._id),
      membershipType: 'guest',
    });
    const guests: { team: RealmRef; policies: RealmPolicySummary }[] = [];
    for (const membership of memberships) {
      const ctx = await resolve(String(membership.realm));
      if (!ctx) continue;
      guests.push({
        team: toRealmRef(ctx.team),
        policies: summarizePolicies(ctx.effective.policies),
      });
    }
    return buildUserRealms({ homeRealmId: home ? homeRealmId : null, home, guests });
  }

  async enterRealm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const ctx = await this.requireRealm(call.request.params.slug);
    const { user, clientId, jwtPayload } = call.request.context;
    const config = ConfigController.getInstance().config;
    // membership and the realm policies are checked by the token provider backstop
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId,
      config,
      realm: String(ctx.team._id),
      ...enterRealmTokenFlags(jwtPayload),
    });
  }

  /**
   * The realm a `sourceRealm` body value names: undefined when not given, null for the global
   * scope (`null`, empty or `global`), else the realm team id (REALM_NOT_FOUND when unknown).
   */
  private async namedSourceRealm(
    sourceRealm: unknown,
  ): Promise<string | null | undefined> {
    if (sourceRealm === undefined) return undefined;
    if (sourceRealm === null || sourceRealm === '' || isGlobalRealmScope(sourceRealm)) {
      return null;
    }
    const ctx = await this.requireRealm(sourceRealm);
    return String(ctx.team._id);
  }

  /**
   * The account a link is made for (see selectLinkSource). A proof token is read here (an
   * expired one is deleted); the choice itself is pure. Anything else is INVALID_LINK_PROOF.
   */
  private async findLinkSource(params: {
    proofToken?: string;
    sourceRealm?: unknown;
    clientId: string;
    session: { user: User; jwtPayload: Indexable } | null;
  }): Promise<{
    userId: string;
    sourceRealmId: string | null;
    proof: Token | null;
    flow: 'proof' | 'session';
    jwtPayload?: Indexable;
  }> {
    const named = await this.namedSourceRealm(params.sourceRealm);
    const now = Date.now();
    const proof = params.proofToken ? await findLinkProof(params.proofToken, now) : null;
    const session = params.session;
    const picked = selectLinkSource({
      proof: proof?.data ?? null,
      clientId: params.clientId,
      sourceRealm: named,
      now,
      session: session
        ? {
            userId: String(session.user._id),
            homeRealmId: session.user.homeRealm ? String(session.user.homeRealm) : null,
            anonymous: !!session.user.isAnonymous,
            authorized: !!session.jwtPayload?.authorized,
          }
        : null,
    });
    if (!picked) throw new ModuleError(errors.INVALID_LINK_PROOF);
    return {
      userId: picked.userId,
      sourceRealmId: picked.sourceRealmId,
      proof: picked.flow === 'proof' ? proof : null,
      flow: picked.flow,
      jwtPayload: picked.flow === 'session' ? session?.jwtPayload : undefined,
    };
  }

  /**
   * The linking settings of the source: outbound linking and the policies of its home realm.
   * A global account links freely; a home realm that is missing or inactive has no outbound
   * linking (fail closed).
   */
  private async linkSourceSettings(
    homeRealmId: string | null,
  ): Promise<{ sourceOutbound: boolean; sourcePolicies: RealmPolicies | null }> {
    if (!homeRealmId) return { sourceOutbound: true, sourcePolicies: null };
    let home: RealmContext | null = null;
    try {
      home = await resolveRealmById(homeRealmId);
    } catch (err) {
      if (!hasConduitCode(err, errors.REALM_NOT_FOUND)) throw err;
    }
    if (!home) return { sourceOutbound: false, sourcePolicies: null };
    return {
      sourceOutbound: home.effective.linking.outbound,
      sourcePolicies: home.effective.policies,
    };
  }

  /**
   * How the invitation of a link relates to the target realm: `inside` when it is valid for
   * the account's email and targets a team of the realm, else `invalid`.
   */
  private async classifyLinkInvite(
    invitationToken: string | undefined,
    email: string,
    realmId: string,
  ): Promise<LinkInvite> {
    if (!invitationToken) return 'none';
    const valid = await TeamsHandler.getInstance().inviteValidation(
      invitationToken,
      email,
    );
    if (!valid) return 'invalid';
    const inviteToken = await Token.getInstance().findOne(
      { tokenType: TokenType.TEAM_INVITE_TOKEN, token: invitationToken },
      { readPreference: 'primary' },
    );
    const inviteRealm = inviteToken?.data?.teamId
      ? await resolveTeamRealm(String(inviteToken.data.teamId))
      : null;
    return inviteRealm && String(inviteRealm._id) === realmId ? 'inside' : 'invalid';
  }

  /**
   * Connects an account to this realm as a guest (see evaluateLinkEligibility for the rules),
   * then returns tokens bound to the realm. A proof token is spent only once the link is
   * allowed; the spend is a conditional delete, so a proof links at most once.
   */
  async linkRealm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const target = await this.requireRealm(call.request.params.slug);
    const targetId = String(target.team._id);
    const config = ConfigController.getInstance().config;
    const { proofToken, sourceRealm, invitationToken } = call.request.params;
    const { user: sessionUser, jwtPayload, clientId } = call.request.context;
    const session = sessionUser ? { user: sessionUser, jwtPayload } : null;

    const source = await this.findLinkSource({
      proofToken,
      sourceRealm,
      clientId,
      session,
    });
    const user = await User.getInstance().findOne(
      { _id: source.userId },
      { readPreference: 'primary' },
    );
    if (!user) throw new ModuleError(errors.INVALID_LINK_PROOF);
    const homeRealmId = user.homeRealm ? String(user.homeRealm) : null;
    // the account may have moved home, or gained 2FA, since the proof was issued
    if (
      !linkSourceStillValid({
        flow: source.flow,
        sourceRealmId: source.sourceRealmId,
        homeRealmId,
        hasTwoFA: !!user.hasTwoFA,
      })
    ) {
      throw new ModuleError(errors.INVALID_LINK_PROOF);
    }
    // an inactive account is no link source: refused as a source that is not authenticated
    if (!user.active) throw new ModuleError(errors.INVALID_LINK_PROOF);

    const { sourceOutbound, sourcePolicies } = await this.linkSourceSettings(homeRealmId);
    const membership = await RealmMembership.getInstance().findOne(
      { user: String(user._id), realm: targetId },
      { readPreference: 'primary' },
    );
    const principalClash = await realmPrincipalClash(
      targetId,
      identifierQueriesOf(user),
      String(user._id),
    );
    const invite = await this.classifyLinkInvite(invitationToken, user.email, targetId);
    const twoFaPass = source.flow === 'session' && !!source.jwtPayload?.authorized;
    const decision = evaluateLinkEligibility({
      targetRealm: targetId,
      sourceRealm: homeRealmId,
      alreadyGuest: !!membership,
      targetInbound: target.effective.linking.inbound,
      sourceOutbound,
      targetPolicies: target.effective.policies,
      sourcePolicies,
      assurance: {
        authorized: tokenAssurance({ hasTwoFA: !!user.hasTwoFA, twoFaPass }).authorized,
        hasTwoFA: !!user.hasTwoFA,
        isVerified: !!user.isVerified,
        clientId,
      },
      allowWithoutInvite: target.effective.registration.allowWithoutInvite,
      invite,
      principalClash: !!principalClash,
    });
    if (!decision.allowed) throw new ModuleError(errors[decision.error]);

    if (source.proof) await consumeLinkProof(source.proof);
    if (invite === 'inside') {
      // the invitation makes the guest membership and the team relation (the invitation is
      // spent by the team code when it was sent to this email)
      await TeamsHandler.getInstance().addUserToTeam(user, invitationToken!);
    } else {
      await grantRealmMembership(this.grpcSdk, {
        userId: String(user._id),
        realmTeamId: targetId,
        type: 'guest',
        role: 'member',
        enforceGuestPolicy: true,
      });
    }
    const flags =
      source.flow === 'proof'
        ? { twoFaPass: false, noSudo: true }
        : enterRealmTokenFlags(source.jwtPayload);
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId,
      config,
      realm: targetId,
      ...flags,
    });
  }

  /**
   * Leaves a guest realm: the membership, the sessions bound to the realm, and the user's
   * relations on the realm team and its sub-teams. A home realm is refused.
   */
  async leaveRealm(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const target = await this.requireRealm(call.request.params.slug);
    const targetId = String(target.team._id);
    const { user } = call.request.context;
    const userId = String(user._id);
    if (isLeaveRefused(user.homeRealm, targetId)) {
      throw new ModuleError(errors.HOME_USER_REMOVAL);
    }
    // the realm team's own relation is removed with the membership (removeRelations)
    await revokeRealmMembership(this.grpcSdk, {
      userId,
      realmTeamId: targetId,
      removeRelations: true,
    });
    for (const teamId of subteamIdsOnLeave(
      targetId,
      await collectTeamSubtreeIds(targetId),
    )) {
      try {
        await this.grpcSdk.authorization!.deleteAllRelations({
          subject: 'User:' + userId,
          resource: 'Team:' + teamId,
        });
      } catch {
        // authorization throws when no relation exists
      }
    }
    return 'OK';
  }

  async discover(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!realmsEnabled()) throw new ModuleError(errors.REALMS_DISABLED);
    const { allowEmailDiscovery } = ConfigController.getInstance().config.teams.realms;
    if (!allowEmailDiscovery) throw new GrpcError(status.NOT_FOUND, 'Not found');
    const email = String(call.request.params.email).trim().toLowerCase();
    // a global lookup: in isolated mode the same email may be held by several accounts,
    // each under its own home realm. An unknown email answers like a global account, as it
    // always did, so the answer does not show whether an address is in use.
    // capped: an address is held by a handful of accounts at most, and the cap bounds the read
    const users = await User.getInstance().findMany(
      { email },
      { limit: DISCOVER_MAX_HOLDERS },
    );
    const homeRealmIds = users.length > 0 ? users.map(user => user.homeRealm) : [null];
    const slugs: (string | null)[] = [];
    for (const homeRealm of new Set(homeRealmIds.map(id => (id ? String(id) : null)))) {
      const slug = homeRealm ? await getRealmSlugById(homeRealm) : null;
      const entry = isNil(slug) ? null : slug;
      if (!slugs.includes(entry)) slugs.push(entry);
    }
    return { slugs };
  }
}
