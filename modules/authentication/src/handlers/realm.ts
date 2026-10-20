import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
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
import { AUTH_CREDENTIALS, OAUTH_CALLBACK } from '../constants/index.js';
import { errors } from '../errors.js';
import { RealmMembership, User } from '../models/index.js';
import {
  getRealmSlugById,
  realmsEnabled,
  RealmContext,
  resolveRealmById,
} from '../utils/realm.js';
import {
  buildRealmDiscovery,
  buildUserRealms,
  enterRealmTokenFlags,
  RealmPolicySummary,
  RealmRef,
  summarizePolicies,
  toRealmRef,
} from './realm.logic.js';
import { resolveRealmFromSlug } from './realmRequest.js';
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
