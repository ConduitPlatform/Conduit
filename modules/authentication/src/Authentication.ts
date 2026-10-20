import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcCallback,
  GrpcError,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
  Indexable,
  Query,
  SetConfigRequest,
  SetConfigResponse,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import { isEmpty, isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import AppConfigSchema, { Config } from './config/index.js';
import { AdminHandlers } from './admin/index.js';
import { AuthenticationRoutes } from './routes/index.js';
import * as models from './models/index.js';
import { Token, User } from './models/index.js';
import { AuthUtils } from './utils/index.js';
import { REALM_UPDATE_EVENT, TokenType } from './constants/index.js';
import { v4 as uuid } from 'uuid';
import {
  AnonymousUserCreateRequest,
  CreateTeamRequest,
  GetRealmSettingsRequest,
  GetTeamRequest,
  InvitationDeleteRequest,
  InvitationDeleteResponse,
  InviteUserToTeamRequest,
  InviteUserToTeamResponse,
  ModifyTeamMembersRequest,
  RealmMembershipRequest,
  RealmResponse,
  SetTeamRealmRequest,
  Team as GrpcTeam,
  TeamDeleteRequest,
  TeamDeleteResponse,
  UnsetTeamRealmRequest,
  UnsetTeamRealmResponse,
  UpdateTeamRequest,
  UserChangePass,
  UserCreateByUsernameRequest,
  UserCreateRequest,
  UserCreateResponse,
  UserDeleteRequest,
  UserDeleteResponse,
  UserLoginRequest,
  UserLoginResponse,
  UserModifyStatusRequest,
  UserModifyStatusResponse,
  ValidateAccessTokenRequest,
  ValidateAccessTokenResponse,
  ValidateAccessTokenResponse_Status,
} from './protoTypes/authentication.js';
import { Empty } from './protoTypes/google/protobuf/empty.js';
import { runMigrations } from './migrations/index.js';
import metricsSchema from './metrics/index.js';
import { TokenProvider } from './handlers/tokenProvider.js';
import {
  ConduitActiveSchema,
  ConfigController,
  convictConfigParser,
  createParsedRouterRequest,
  ManagedModule,
  ModuleError,
  sanitizeDocumentsForExport,
  type ExportableResource,
  type ExportResult,
  type ImportResult,
} from '@conduitplatform/module-tools';
import {
  ensureAccessTokenJwtSecret,
  isConfigMissingError,
  type PersistedConfigRead,
} from './utils/jwtSecret.js';
import { reconcileSharedAccessTokenJwtSecret } from './utils/jwtSecretReconciler.js';
import { TeamsAdmin } from './admin/team.js';
import { User as UserAuthz } from './authz/index.js';
import { handleAuthentication } from './routes/middleware.js';
import { fileURLToPath } from 'node:url';
import { TeamsHandler } from './handlers/team.js';
import { validateAppleClients } from './handlers/oauth2/utils/validateAppleClients.js';
import {
  assertAnonymousRealmAllowed,
  assertAnonymousUserInRealm,
  grantHomeMembership,
  homeRealmFields,
  realmIdOf,
  resolveRealmFromSlug,
  rollbackUserOnFailure,
  scopedUserQuery,
} from './handlers/realmRequest.js';
import {
  assertNoNestedRealm,
  countIdentifierCollisions,
  deleteUserRealmMemberships,
  getRealmSlugById,
  identityMode,
  identityModeRevertBlockedMessage,
  invalidateRealmCache,
  isIdentityModeRevertTransition,
  isRealmsDisableTransition,
  realmsDisableBlockedMessage,
  realmsEnabled,
  resolveTeamRealm,
  uniqueIdentifierQuery,
} from './utils/realm.js';
import {
  collectTeamSubtreeIds,
  collectTeamUserIds,
  revokeOrphanedGuests,
} from './utils/teamRealm.js';
import { RealmsAdmin } from './admin/realm.js';
import {
  assertTeamId,
  assertUserId,
  buildSetRealmParams,
  assertGrantMembershipAllowed,
  parseMembershipType,
  parseOptionalMembershipType,
  toCallbackError,
  toGrpcTeam,
  toRealmResponse,
} from './utils/realmGrpc.logic.js';
import { buildTeamRealmExports, importTeamRealms } from './utils/realmExport.js';
import { ImportTally } from './utils/realmExport.logic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Authentication extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'authentication.proto'),
    protoDescription: 'authentication.Authentication',
    functions: {
      userLogin: this.userLogin.bind(this),
      userModifyStatus: this.userModifyStatus.bind(this),
      userCreate: this.userCreate.bind(this),
      userCreateByUsername: this.userCreateByUsername.bind(this),
      anonymousUserCreate: this.anonymousUserCreate.bind(this),
      changePass: this.changePass.bind(this),
      userDelete: this.userDelete.bind(this),
      getTeam: this.getTeam.bind(this),
      createTeam: this.createTeam.bind(this),
      teamDelete: this.teamDelete.bind(this),
      validateAccessToken: this.validateAccessToken.bind(this),
      addTeamMembers: this.addTeamMembers.bind(this),
      removeTeamMembers: this.removeTeamMembers.bind(this),
      invitationDelete: this.invitationDelete.bind(this),
      inviteUserToTeam: this.inviteUserToTeam.bind(this),
      updateTeam: this.updateTeam.bind(this),
      setTeamRealm: this.setTeamRealm.bind(this),
      getRealmSettings: this.getRealmSettings.bind(this),
      unsetTeamRealm: this.unsetTeamRealm.bind(this),
      grantRealmMembership: this.grantRealmMembership.bind(this),
      revokeRealmMembership: this.revokeRealmMembership.bind(this),
    },
  };
  protected metricsSchema = metricsSchema;
  private adminRouter: AdminHandlers;
  private userRouter: AuthenticationRoutes;
  private database: DatabaseProvider;
  private refreshAppRoutesTimeout: NodeJS.Timeout | null = null;
  private tokenCleanupInterval: ReturnType<typeof setInterval> | null = null;
  private monitorsActive = false;
  private realmBusSubscribed = false;
  private _authzUserResourceDispose: (() => void) | null = null;

  constructor(peerManifestRoot?: string) {
    super('authentication', peerManifestRoot);
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.awaitPeersFromManifest();
    this._authzUserResourceDispose = this.grpcSdk.oncePeerUp(
      'authorization',
      async () => {
        this._authzUserResourceDispose = null;
        await this.grpcSdk.authorization!.defineResource(UserAuthz);
      },
    );
    this.database = this.grpcSdk.database!;
    TokenProvider.getInstance(this.grpcSdk);
    await this.registerSchemas();
    this.subscribeToRealmUpdates();
    await runMigrations(this.grpcSdk);
    for (const model of Object.values(models)) {
      const modelInstance = model.getInstance();
      if (
        Object.keys((modelInstance as ConduitActiveSchema<typeof modelInstance>).fields)
          .length === 0
      )
        continue;
      await this.database.migrate(modelInstance.name);
    }
  }

  // Framework export/import (GitOps)
  protected getExportableResources(): ExportableResource[] {
    return [
      {
        type: 'teams',
        description:
          'Team structure (name, parent, isDefault, realm and realm settings). ' +
          'Realm import: the file is the source of truth for the realms it enables ' +
          '(a realm team without realmSettings is reset to the defaults); a file with ' +
          'realm.enabled false leaves a realm that exists in the database alone ' +
          '(demote it explicitly). Secrets are never exported or imported. Trusted home ' +
          'realms are exported as slugs, or unresolved:<id> when the id is no enabled ' +
          'realm; an unresolved entry fails closed on import (the stored list is kept, ' +
          'or guests are disabled for a new realm) and is reported per team.',
        priority: 35,
      },
    ];
  }

  protected async exportResources(resourceTypes?: string[]): Promise<ExportResult> {
    if (!this.database) return {};
    if (resourceTypes && resourceTypes.length > 0 && !resourceTypes.includes('teams'))
      return {};
    const teamModel = models.Team.getInstance(this.database);
    const teams = (await teamModel.findMany({})) as (Indexable & {
      parentTeam?: string;
      name: string;
    })[];
    const parentIds = [
      ...new Set(teams.map(t => t.parentTeam).filter(Boolean)),
    ] as string[];
    const parentTeams = parentIds.length
      ? await teamModel.findMany({ _id: { $in: parentIds } })
      : [];
    const parentNameById = new Map(
      (parentTeams as Indexable[]).map((p: Indexable) => [p._id, p.name]),
    );
    const realmExports = await buildTeamRealmExports(teams);
    const forExport = teams.map(t => {
      const { _id, parentTeam, createdAt, updatedAt, ...rest } = t;
      // realm marker and non-secret settings (secrets export as null)
      const out = { ...rest, ...realmExports.get(String(_id)) };
      if (parentTeam && parentNameById.has(parentTeam)) {
        (out as Indexable).parentTeamName = parentNameById.get(parentTeam);
      }
      return out;
    });
    return { teams: sanitizeDocumentsForExport(forExport as Record<string, unknown>[]) };
  }

  protected async importResources(data: ExportResult): Promise<ImportResult> {
    if (!this.database) return {};
    const result: ImportResult = {
      teams: { created: 0, updated: 0, failed: 0, errors: [] },
    };
    // every record is counted once, whatever step it fails in
    const tally = new ImportTally(result.teams);
    const teamModel = models.Team.getInstance(this.database);
    const teams = (data.teams ?? []) as {
      name: string;
      parentTeamName?: string;
      isDefault?: boolean;
      realm?: unknown;
      realmSettings?: unknown;
    }[];
    for (const [index, rec] of teams.entries()) {
      const name = rec.name;
      if (name == null || name === '') {
        tally.failed(index, 'Missing name');
        continue;
      }
      try {
        const existing = await teamModel.findOne({ name });
        if (existing) {
          await teamModel.updateOne({ name }, { isDefault: rec.isDefault ?? false });
          tally.updated(index);
        } else {
          await teamModel.create({ name, isDefault: rec.isDefault ?? false });
          tally.created(index);
        }
      } catch (e) {
        tally.failed(index, `${name}: ${(e as Error).message}`);
      }
    }
    for (const [index, rec] of teams.entries()) {
      if (!rec.parentTeamName) continue;
      try {
        const parent = await teamModel.findOne(
          { name: rec.parentTeamName },
          { readPreference: 'primary' },
        );
        if (parent) {
          const child = await teamModel.findOne({ name: rec.name });
          if (child) {
            // a realm stays top-level and never contains or sits inside another realm
            await assertNoNestedRealm(String(child._id), String(parent._id));
          }
          await teamModel.updateOne(
            { name: rec.name },
            { parentTeam: (parent as Indexable)._id },
          );
        }
      } catch (e) {
        // a missing parent is ignored (as before); a realm that would nest is reported
        if (e instanceof ModuleError) {
          tally.failed(index, `${rec.name}: parent: ${(e as Error).message}`);
        }
      }
    }
    // realms need the final team tree (a realm is top-level) and never import secrets
    const realmsChanged = await importTeamRealms(this.grpcSdk, teams, tally);
    if (realmsChanged) this.notifyRealmsImported();
    return result;
  }

  private notifyRealmsImported() {
    invalidateRealmCache();
    this.grpcSdk.bus?.publish(REALM_UPDATE_EVENT, JSON.stringify({ import: true }));
    if (ConfigController.getInstance().config?.active) this.refreshAppRoutes();
  }

  /**
   * Refuses config updates that would leave the realm data in an unsafe state, checked here
   * and not in `preConfig`, which also runs for config updates received from the bus and for
   * the startup reconciliation, where a throw would not reach the caller of the update:
   *  - switching the realms feature off while enabled realm teams exist (the "flag off = no
   *    realm data" invariant): demote them first;
   *  - returning the identity mode from isolated to shared while an identifier is held by
   *    more than one account (identifiers would become ambiguous).
   * The database is only queried on those transitions.
   */
  async setConfig(
    call: GrpcRequest<SetConfigRequest>,
    callback: GrpcResponse<SetConfigResponse>,
  ) {
    let incomingTeams: Config['teams'] | undefined;
    try {
      incomingTeams = JSON.parse(call.request.newConfig)?.teams;
    } catch {
      // malformed JSON is reported by the base implementation
    }
    const previousTeams = ConfigController.getInstance().config?.teams;
    if (isIdentityModeRevertTransition(previousTeams, incomingTeams)) {
      try {
        const collisions = await countIdentifierCollisions();
        const blocked = identityModeRevertBlockedMessage(collisions.total);
        if (blocked) {
          return callback({ code: status.FAILED_PRECONDITION, message: blocked });
        }
      } catch (e) {
        return callback({
          code: status.INTERNAL,
          message: `Could not verify identifier uniqueness: ${(e as Error).message}`,
        });
      }
    }
    if (isRealmsDisableTransition(previousTeams, incomingTeams)) {
      try {
        const enabledRealmsQuery: Indexable = { 'realm.enabled': true };
        const enabledRealms =
          await models.Team.getInstance().countDocuments(enabledRealmsQuery);
        const blocked = realmsDisableBlockedMessage(enabledRealms);
        if (blocked) {
          return callback({ code: status.FAILED_PRECONDITION, message: blocked });
        }
      } catch (e) {
        return callback({
          code: status.INTERNAL,
          message: `Could not verify that no enabled realms exist: ${(e as Error).message}`,
        });
      }
    }
    return super.setConfig(call, callback);
  }

  async preConfig(config: Config) {
    if (this.configInitialized) {
      ensureAccessTokenJwtSecret(config);
    }
    if (config.captcha?.hasOwnProperty('provider')) {
      delete (config as Config & { captcha: { provider?: string } }).captcha.provider;
    }
    if (config.captcha?.hasOwnProperty('secretKey')) {
      delete (config as Config & { captcha: { secretKey?: string } }).captcha.secretKey;
    }
    if (
      (
        config.accessTokens
          .cookieOptions as (typeof config.accessTokens)['cookieOptions'] & {
          maxAge?: number;
        }
      ).maxAge
    ) {
      delete (
        config.accessTokens
          .cookieOptions as (typeof config.accessTokens)['cookieOptions'] & {
          maxAge?: number;
        }
      )['maxAge'];
    }
    if (
      (
        config.refreshTokens
          .cookieOptions as (typeof config.accessTokens)['cookieOptions'] & {
          maxAge?: number;
        }
      ).maxAge
    ) {
      delete (
        config.refreshTokens
          .cookieOptions as (typeof config.refreshTokens)['cookieOptions'] & {
          maxAge?: number;
        }
      )['maxAge'];
    }

    if (config.apple?.clients) {
      validateAppleClients(config.apple.clients);
    }

    return config;
  }

  async onConfig() {
    const config = ConfigController.getInstance().config;
    // realm contexts embed the global config (inherited OAuth credentials, local
    // verification...), so any config change, a credential rotation included, must
    // rebuild them (this also drops the per-realm OAuth settings)
    invalidateRealmCache();
    await this.ensureSharedAccessTokenJwtSecret(config);
    if (config.redirectUris.allowAny && process.env.NODE_ENV === 'production') {
      ConduitGrpcSdk.Logger.warn(
        `Config option redirectUris.allowAny shouldn't be used in production!`,
      );
    }
    if (!config.active) {
      this.stopTokenCleanup();
      this.destroyMonitors();
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      const shouldSendVerificationEmail = config.local.verification.send_email;
      if (shouldSendVerificationEmail && !this.grpcSdk.isAvailable('email')) {
        await this.grpcSdk.refreshModules(true);
      }
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk, () =>
        this.refreshAppRoutes(),
      );
      this.refreshAppRoutes();
      this.initMonitors();
      this.startTokenCleanup();
      this.updateHealth(HealthCheckStatus.SERVING);
      if (shouldSendVerificationEmail) {
        if (!this.grpcSdk.isAvailable('email')) {
          ConduitGrpcSdk.Logger.warn(
            'Failed to enable email verification for local authentication strategy. Email module not serving.',
          );
        }
      }
    }
  }

  private async readPersistedAuthenticationConfig(): Promise<
    PersistedConfigRead<Config>
  > {
    try {
      const persisted = await this.grpcSdk.config.get('authentication');
      return { ok: true, config: persisted };
    } catch (error) {
      if (isConfigMissingError(error)) {
        return { ok: true, config: null };
      }
      return { ok: false };
    }
  }

  /**
   * Replicas must share one jwtSecret. Startup adopts persist or mints
   * once under lock. Later setConfig/bus updates keep the applied secret.
   * A failed read must not persist.
   */
  private async ensureSharedAccessTokenJwtSecret(config: Config) {
    await reconcileSharedAccessTokenJwtSecret(config, {
      configInitialized: this.configInitialized,
      readPersisted: () => this.readPersistedAuthenticationConfig(),
      syncConfig: next => {
        if (this.config) {
          this.config.load(next);
        }
        ConfigController.getInstance().config = next;
      },
      persistOverride: async next => {
        if (!this.config) {
          throw new Error('Authentication config schema is not initialized');
        }
        await this.grpcSdk.config.configure(
          next,
          convictConfigParser(this.config.getSchema()),
          true,
        );
      },
      withLock: (resource, ttl, fn) => {
        if (!this.grpcSdk.state) {
          throw new Error('State manager is not initialized');
        }
        return this.grpcSdk.state.withLock(resource, ttl, fn);
      },
    });
  }

  /**
   * Realm settings live in the database. Every realm write publishes this event (the bus
   * skips the publisher, which refreshes itself): replicas clear their realm cache and
   * re-register routes, since a realm may now enable or disable a provider.
   */
  private subscribeToRealmUpdates() {
    if (this.realmBusSubscribed || !this.grpcSdk.bus) return;
    this.realmBusSubscribed = true;
    this.grpcSdk.bus.subscribe(REALM_UPDATE_EVENT, () => {
      invalidateRealmCache();
      if (ConfigController.getInstance().config?.active) this.refreshAppRoutes();
    });
  }

  initMonitors() {
    if (this.monitorsActive) return;
    this.monitorsActive = true;
    this.registerDeclaredPeerWatches();
  }

  destroyMonitors() {
    if (!this.monitorsActive) return;
    this.monitorsActive = false;
    this.disposeDeclaredPeerWatches();
    this._authzUserResourceDispose?.();
    this._authzUserResourceDispose = null;
  }

  protected override onDeclaredPeerConnectionUpdate(
    moduleName: string,
    serving: boolean,
  ): void {
    if (moduleName === 'router' && serving) {
      if (!this.userRouter) {
        this.userRouter = new AuthenticationRoutes(this.grpcServer, this.grpcSdk);
      }
      this.scheduleAppRouteRefresh();
      return;
    }
    if (!serving) return;
    if (moduleName === 'authorization') {
      this.refreshAppRoutes();
      this.adminRouter?.registerAdminRoutes();
      return;
    }
    this.refreshAppRoutes();
  }
  async initializeMetrics() {
    AuthUtils.initMetricsRedis(this.grpcSdk);
    await AuthUtils.reconcileLoggedInUsersMetric();
  }

  // produces login credentials for a user without them having to login
  async userLogin(
    call: GrpcRequest<UserLoginRequest>,
    callback: GrpcCallback<UserLoginResponse>,
  ) {
    const { userId, clientId, realm } = call.request;
    const user = await models.User.getInstance(this.database).findOne({ _id: userId });
    if (!user) {
      return callback({
        code: status.NOT_FOUND,
        message: 'User not found',
      });
    }
    if (!user.active) {
      return callback({
        code: status.PERMISSION_DENIED,
        message: 'User is blocked or deleted',
      });
    }
    const config = ConfigController.getInstance().config;

    try {
      // internal trusted path: the session lives in the requested realm, defaulting to
      // the user's own home realm (token issuance still checks the user's access)
      const realmCtx = await resolveRealmFromSlug(realm);
      const tokens = await TokenProvider.getInstance().provideUserTokensInternal({
        user,
        clientId,
        config,
        realm: realmCtx
          ? String(realmCtx.team._id)
          : user.homeRealm
            ? String(user.homeRealm)
            : null,
      });

      return callback(null, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? undefined,
      });
    } catch (e) {
      if (e instanceof GrpcError) return callback(toCallbackError(e));
      return callback({
        code: status.INTERNAL,
        message: 'Failed to login',
      });
    }
  }

  async userCreate(
    call: GrpcRequest<UserCreateRequest>,
    callback: GrpcCallback<UserCreateResponse>,
  ) {
    const email = call.request.email.toLowerCase();
    const verify = call.request.verify;
    let password = call.request.password;
    let userData: Indexable = {};

    const verificationConfig = ConfigController.getInstance().config.local.verification;
    if (verify && !(verificationConfig.required && verificationConfig.send_email)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Email verification is disabled. Configuration required.',
      });
    }
    if (isNil(password) || password.length === 0) {
      password = AuthUtils.randomToken(8);
    }
    if (call.request.userData) {
      userData = JSON.parse(call.request.userData);
      AuthUtils.checkUserData(userData);
    }

    try {
      const realmCtx = await resolveRealmFromSlug(call.request.realm);
      let user = await models.User.getInstance().findOne(
        uniqueIdentifierQuery({ email }, realmIdOf(realmCtx)),
      );
      if (user) {
        return callback({ code: status.ALREADY_EXISTS, message: 'User already exists' });
      }
      AuthUtils.assertValidEmail(email);
      const hashedPassword = await AuthUtils.hashPassword(password);
      const anonymousUserId = call.request.anonymousId;
      if (!anonymousUserId) {
        user = await models.User.getInstance().create({
          email,
          hashedPassword,
          isVerified: !verify,
          ...userData,
          ...homeRealmFields(realmCtx),
        });
        if (realmCtx) {
          // a realm user is never left without its membership
          const createdUser = user;
          await rollbackUserOnFailure(this.grpcSdk, createdUser, () =>
            grantHomeMembership(this.grpcSdk, createdUser, realmCtx),
          );
        }
      } else {
        const config = ConfigController.getInstance().config;
        if (!config.anonymousUsers.enabled) {
          return callback({
            code: status.FAILED_PRECONDITION,
            message: 'Anonymous users configuration is disabled',
          });
        }
        if (realmCtx) {
          // the anonymous user keeps its home realm on conversion
          const anonymousUser = await models.User.getInstance().findOne({
            _id: anonymousUserId,
            isAnonymous: true,
          });
          if (anonymousUser) assertAnonymousUserInRealm(anonymousUser, realmCtx);
        }
        user = await models.User.getInstance().findByIdAndUpdate(anonymousUserId, {
          email,
          hashedPassword,
          isAnonymous: false,
          isVerified: !verify,
          ...userData,
        });
        if (!user) {
          return callback({
            code: status.NOT_FOUND,
            message: 'Anonymous user not found',
          });
        }
      }
      const sendEmail =
        ConfigController.getInstance().config.local.verification.send_email;
      const emailAvailable = this.grpcSdk.isAvailable('email');
      if (verify && sendEmail && emailAvailable) {
        const serverConfig = await this.grpcSdk.config.get('router');
        const url = serverConfig.hostUrl;
        const verificationToken: models.Token = await models.Token.getInstance().create({
          tokenType: TokenType.VERIFICATION_TOKEN,
          user: user._id,
          token: uuid(),
        });
        const result = { verificationToken, hostUrl: url };
        const link = `${result.hostUrl}/hook/authentication/verify-email/${result.verificationToken.token}`;
        const safeUser = { ...user };
        delete safeUser.hashedPassword;
        await this.grpcSdk.emailProvider!.sendEmail('EmailVerification', {
          email: user.email,
          variables: {
            link,
            user: safeUser,
          },
        });
      } else if (verify) {
        ConduitGrpcSdk.Logger.error(
          'Failed to send verification email.' + ' Email service not online!',
        );
      }
      if (!anonymousUserId && !realmCtx) {
        await TeamsHandler.getInstance()
          .addUserToDefault(user)
          .catch(err => {
            ConduitGrpcSdk.Logger.error(err);
          });
      }
      return callback(null, { password });
    } catch (e) {
      if (e instanceof GrpcError) {
        return callback({ code: e.code, message: e.message });
      }
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }

  async userCreateByUsername(
    call: GrpcRequest<UserCreateByUsernameRequest>,
    callback: GrpcCallback<UserCreateResponse>,
  ) {
    const username = call.request.username.toLowerCase();
    let password = call.request.password;

    if (isNil(password) || password.length === 0) {
      password = AuthUtils.randomToken(8);
    }
    let realmCtx;
    try {
      realmCtx = await resolveRealmFromSlug(call.request.realm);
    } catch (e) {
      if (e instanceof GrpcError) {
        return callback({ code: e.code, message: e.message });
      }
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    try {
      let user = await models.User.getInstance().findOne(
        uniqueIdentifierQuery({ username }, realmIdOf(realmCtx)),
      );
      if (user) {
        return callback({ code: status.ALREADY_EXISTS, message: 'User already exists' });
      }
      const hashedPassword = await AuthUtils.hashPassword(password);
      const anonymousUserId = call.request.anonymousId;
      if (!anonymousUserId) {
        user = await models.User.getInstance().create({
          username,
          hashedPassword,
          isVerified: true,
          ...homeRealmFields(realmCtx),
        });
        if (realmCtx) {
          // a realm user is never left without its membership
          const createdUser = user;
          await rollbackUserOnFailure(this.grpcSdk, createdUser, () =>
            grantHomeMembership(this.grpcSdk, createdUser, realmCtx),
          );
        } else {
          await TeamsHandler.getInstance()
            .addUserToDefault(user)
            .catch(err => {
              ConduitGrpcSdk.Logger.error(err);
            });
        }
      } else {
        const config = ConfigController.getInstance().config;
        if (!config.anonymousUsers.enabled) {
          return callback({
            code: status.FAILED_PRECONDITION,
            message: 'Anonymous users configuration is disabled',
          });
        }
        if (realmCtx) {
          // the anonymous user keeps its home realm on conversion
          const anonymousUser = await models.User.getInstance().findOne({
            _id: anonymousUserId,
            isAnonymous: true,
          });
          if (anonymousUser) assertAnonymousUserInRealm(anonymousUser, realmCtx);
        }
        user = await models.User.getInstance().findByIdAndUpdate(anonymousUserId, {
          username,
          hashedPassword,
          isAnonymous: false,
          isVerified: true,
        });
        if (!user) {
          return callback({
            code: status.NOT_FOUND,
            message: 'Anonymous user not found',
          });
        }
      }
      return callback(null, { password });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }

  async anonymousUserCreate(
    call: GrpcRequest<AnonymousUserCreateRequest>,
    callback: GrpcCallback<UserLoginResponse>,
  ) {
    const config = ConfigController.getInstance().config;
    if (!config.anonymousUsers.enabled) {
      return callback({
        code: status.FAILED_PRECONDITION,
        message: 'Anonymous user creation is disabled',
      });
    }
    const { clientId } = call.request;
    let realmCtx;
    try {
      realmCtx = await resolveRealmFromSlug(call.request.realm);
    } catch (e) {
      if (e instanceof GrpcError) {
        return callback({ code: e.code, message: e.message });
      }
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    const email = `${uuid()}@anonymous.com`;
    try {
      // refused by the realm policies (2FA, verified email, client pinning): fail before
      // a user is created
      assertAnonymousRealmAllowed(realmCtx, clientId);
      const anonymousUser = await User.getInstance().create({
        email,
        isAnonymous: true,
        isVerified: false,
        ...homeRealmFields(realmCtx),
      });
      // any failure from here on must not leave the new anonymous user behind
      const tokens = await rollbackUserOnFailure(
        this.grpcSdk,
        anonymousUser,
        async () => {
          if (realmCtx) {
            await grantHomeMembership(this.grpcSdk, anonymousUser, realmCtx);
          } else {
            await TeamsHandler.getInstance()
              .addUserToDefault(anonymousUser)
              .catch(err => {
                ConduitGrpcSdk.Logger.error(err);
              });
          }
          return TokenProvider.getInstance().provideUserTokensInternal({
            user: anonymousUser,
            clientId: clientId,
            config,
            isRefresh: false,
            realm: realmCtx ? String(realmCtx.team._id) : null,
          });
        },
      );

      return callback(null, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? undefined,
      });
    } catch (e) {
      if (e instanceof GrpcError) {
        return callback({ code: e.code, message: e.message });
      }
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }

  // produces login credentials for a user without them having to login
  async userDelete(
    call: GrpcRequest<UserDeleteRequest>,
    callback: GrpcCallback<UserDeleteResponse>,
  ) {
    const { userId } = call.request;
    try {
      await models.User.getInstance().deleteOne({ _id: userId });
      // no membership row or session may outlive its user
      await deleteUserRealmMemberships(userId);
      await Promise.all([
        models.AccessToken.getInstance().deleteMany({ user: userId }),
        models.RefreshToken.getInstance().deleteMany({ user: userId }),
      ]);
      return callback(null, {
        message: 'ok',
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }

  // gRPC Service
  async changePass(
    call: GrpcRequest<UserChangePass>,
    callback: GrpcCallback<UserCreateResponse>,
  ) {
    const email = call.request.email.toLowerCase();
    let password = call.request.password;
    if (isNil(password) || password.length === 0) {
      password = AuthUtils.randomToken(8);
    }
    try {
      // a realm scopes the lookup to that realm's accounts. Without one, shared mode looks
      // the (unique) email up as before; isolated mode refuses an email held by several
      // accounts, since the password would otherwise go to an arbitrary one
      const realmCtx = await resolveRealmFromSlug(call.request.realm);
      let user: User | null;
      if (realmCtx) {
        user = await models.User.getInstance().findOne(
          scopedUserQuery({ email }, realmCtx),
        );
      } else if (identityMode() === 'isolated') {
        const holders = await models.User.getInstance().findMany({ email }, { limit: 2 });
        if (holders.length > 1) {
          return callback({
            code: status.FAILED_PRECONDITION,
            message: 'email is held by more than one account; pass realm',
          });
        }
        user = holders[0] ?? null;
      } else {
        user = await models.User.getInstance().findOne({ email });
      }
      if (!user) {
        return callback({ code: status.NOT_FOUND, message: 'User not found' });
      }

      const hashedPassword = await AuthUtils.hashPassword(password);
      await models.User.getInstance().findByIdAndUpdate(user._id, {
        hashedPassword,
      });

      return callback(null, { password });
    } catch (e) {
      return callback(toCallbackError(e));
    }
  }

  async getTeam(call: GrpcRequest<GetTeamRequest>, callback: GrpcCallback<GrpcTeam>) {
    const request = createParsedRouterRequest(call.request);
    try {
      const team = (await new TeamsAdmin(this.grpcSdk).getTeam(request)) as
        models.Team | undefined;
      if (!team) {
        return callback({ code: status.NOT_FOUND, message: 'Team not found' });
      }
      return callback(null, toGrpcTeam(team));
    } catch (e) {
      return callback(toCallbackError(e));
    }
  }

  async createTeam(
    call: GrpcRequest<CreateTeamRequest>,
    callback: GrpcCallback<GrpcTeam>,
  ) {
    const request = createParsedRouterRequest(call.request);
    try {
      const team = (await new TeamsAdmin(this.grpcSdk).createTeam(
        request,
      )) as models.Team;
      return callback(null, toGrpcTeam(team));
    } catch (e) {
      return callback(toCallbackError(e));
    }
  }

  async teamDelete(
    call: GrpcRequest<TeamDeleteRequest>,
    callback: GrpcCallback<TeamDeleteResponse>,
  ) {
    const request = createParsedRouterRequest(call.request);
    const result = await new TeamsAdmin(this.grpcSdk).deleteTeam(request).catch(e => {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    });
    return callback(null, { message: result as string });
  }

  async addTeamMembers(
    call: GrpcRequest<ModifyTeamMembersRequest>,
    callback: GrpcCallback<Empty>,
  ) {
    const teamId = call.request.teamId;
    if (isEmpty(teamId)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'teamId must be a valid Team ID!',
      });
    }
    const urlParams = { teamId };
    const bodyParams = { members: call.request.memberIds };
    const request = createParsedRouterRequest(
      { ...urlParams, ...bodyParams },
      urlParams,
      undefined,
      bodyParams,
    );
    await new TeamsAdmin(this.grpcSdk).addTeamMembers(request).catch(e => {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    });
    return callback(null, {});
  }

  async removeTeamMembers(
    call: GrpcRequest<ModifyTeamMembersRequest>,
    callback: GrpcCallback<Empty>,
  ) {
    const teamId = call.request.teamId;
    if (isEmpty(teamId)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'teamId must be a valid Team ID!',
      });
    }
    const urlParams = { teamId };
    const bodyParams = { members: call.request.memberIds };
    const request = createParsedRouterRequest(
      { ...urlParams, ...bodyParams },
      urlParams,
      undefined,
      bodyParams,
    );
    await new TeamsAdmin(this.grpcSdk).removeTeamMembers(request).catch(e => {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    });
    return callback(null, {});
  }

  async validateAccessToken(
    call: GrpcRequest<ValidateAccessTokenRequest>,
    callback: GrpcCallback<ValidateAccessTokenResponse>,
  ) {
    const accessToken = call.request.accessToken;
    const path = call.request.path ?? '';
    let userId: string | undefined = undefined;
    let realmId: string | null = null;
    let homeRealmId: string | null = null;
    const accessStatus = await handleAuthentication(
      {},
      { authorization: `Bearer ${accessToken}` },
      {},
      path,
    )
      .then(r => {
        const user = r.user as models.User;
        userId = user._id;
        realmId = r.realm ?? null;
        homeRealmId = user.homeRealm ? String(user.homeRealm) : null;
        return ValidateAccessTokenResponse_Status.AUTHENTICATED;
      })
      .catch(err => {
        switch (err.code as status) {
          case status.PERMISSION_DENIED:
            return ValidateAccessTokenResponse_Status.USER_BLOCKED;
          case status.UNAUTHENTICATED:
            if (err.message.includes('2FA')) {
              return ValidateAccessTokenResponse_Status.REQUIRES_2FA;
            }
          // intentional fall through
          default:
            return ValidateAccessTokenResponse_Status.UNAUTHENTICATED;
        }
      });
    // realm and home realm are exposed as slugs (absent for global sessions and users)
    // (a failed lookup must not turn an authenticated answer into an error)
    let realm: string | undefined;
    let homeRealm: string | undefined;
    if (
      accessStatus === ValidateAccessTokenResponse_Status.AUTHENTICATED &&
      realmsEnabled()
    ) {
      try {
        [realm, homeRealm] = await Promise.all([
          getRealmSlugById(realmId),
          getRealmSlugById(homeRealmId),
        ]);
      } catch (e) {
        ConduitGrpcSdk.Logger.warn(
          `Failed to resolve realm slugs for access token validation: ${(e as Error).message}`,
        );
        realm = undefined;
        homeRealm = undefined;
      }
    }
    return callback(null, { status: accessStatus, userId, realm, homeRealm });
  }

  async userModifyStatus(
    call: GrpcRequest<UserModifyStatusRequest>,
    callback: GrpcCallback<UserModifyStatusResponse>,
  ) {
    const { id, active } = call.request as { id: string; active: boolean };
    const user = await User.getInstance().findOne({ _id: id });
    if (!user) {
      return callback({ code: status.NOT_FOUND, message: 'User not found' });
    }
    if (user.active && active) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'User is already active',
      });
    }
    if (!user.active && !active) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'User is already blocked',
      });
    }
    await User.getInstance().findByIdAndUpdate(user._id, { active });
    callback(null, { message: 'ok' });
    if (!active) {
      await TokenProvider.getInstance().deleteUserTokens({
        user: id,
      });

      TokenProvider.getInstance().trackLoggedOutUserMetric(id);
    }
  }

  async invitationDelete(
    call: GrpcRequest<InvitationDeleteRequest>,
    callback: GrpcCallback<InvitationDeleteResponse>,
  ) {
    const { email, teamId } = call.request;

    try {
      const deletedToken = await Token.getInstance().deleteOne({
        'data.teamId': teamId,
        'data.email': email,
      } as Query<Token>);

      if (deletedToken.deletedCount === 0) {
        return callback({
          code: status.NOT_FOUND,
          message: 'Invitation not found',
        });
      }

      return callback(null, {
        message: 'Invitation deleted successfully',
      });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: (e as Error).message,
      });
    }
  }

  async inviteUserToTeam(
    call: GrpcRequest<InviteUserToTeamRequest>,
    callback: GrpcCallback<InviteUserToTeamResponse>,
  ) {
    const { teamId, email, role, redirectUri, inviterUserId, userData } = call.request;
    if (isEmpty(teamId) || isEmpty(email) || isEmpty(role) || isEmpty(inviterUserId)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'teamId, email, role and inviterUserId are required',
      });
    }

    try {
      const inviter = await User.getInstance().findOne({ _id: inviterUserId });
      if (!inviter) {
        return callback({ code: status.NOT_FOUND, message: 'Inviter user not found' });
      }

      let parsedUserData: Indexable | undefined = undefined;
      if (!isNil(userData) && userData !== '') {
        try {
          parsedUserData = JSON.parse(userData);
        } catch (e) {
          return callback({
            code: status.INVALID_ARGUMENT,
            message: 'userData must be valid JSON',
          });
        }
      }

      const request = createParsedRouterRequest(
        { teamId, email, role, redirectUri, userData: parsedUserData },
        { teamId },
        undefined,
        { email, role, redirectUri, userData: parsedUserData },
        undefined,
        undefined,
        { user: inviter },
      );

      const invitationToken = (await TeamsHandler.getInstance(this.grpcSdk).userInvite(
        request,
      )) as string;
      return callback(null, { invitationToken });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }

  async updateTeam(
    call: GrpcRequest<UpdateTeamRequest>,
    callback: GrpcCallback<GrpcTeam>,
  ) {
    const { teamId, name, newParentTeamId } = call.request;

    try {
      if (!name && !newParentTeamId) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'At least one of name or newParentTeamId must be provided',
        });
      }

      const team = await models.Team.getInstance().findOne({ _id: teamId });
      if (!team) {
        return callback({ code: status.NOT_FOUND, message: 'Team not found' });
      }

      const updateFields: { name?: string; parentTeam?: string } = {
        ...(name && { name }),
      };

      // An empty newParentTeamId means "parent unchanged" in this RPC (a team cannot be
      // moved to the top level through it), so only a real re-parent touches realms.
      let oldRealmId: string | null = null;
      let movedUserIds: string[] = [];
      if (newParentTeamId) {
        if (realmsEnabled()) {
          // a realm stays top-level and never contains or sits inside another realm
          await assertNoNestedRealm(teamId, newParentTeamId);
          const oldRealm = await resolveTeamRealm(teamId);
          if (oldRealm) {
            // collected before the move: guests whose only relations in the old realm
            // were on this subtree lose their guest membership afterwards
            oldRealmId = String(oldRealm._id);
            movedUserIds = await collectTeamUserIds(
              this.grpcSdk,
              await collectTeamSubtreeIds(teamId),
            );
          }
        }
        const newParentTeam = await models.Team.getInstance().findOne({
          _id: newParentTeamId,
        });
        if (!newParentTeam) {
          return callback({
            code: status.NOT_FOUND,
            message: 'New parent team not found',
          });
        }

        const oldParentTeamId = team.parentTeam;

        if (oldParentTeamId) {
          try {
            await this.grpcSdk.authorization!.deleteRelation({
              subject: 'Team:' + oldParentTeamId,
              relation: 'owner',
              resource: 'Team:' + teamId,
            });
          } catch (e) {
            ConduitGrpcSdk.Logger.warn(
              `Failed to delete old parent relation: ${(e as Error).message}`,
            );
          }
        }

        await this.grpcSdk.authorization!.createRelation({
          subject: 'Team:' + newParentTeamId,
          relation: 'owner',
          resource: 'Team:' + teamId,
        });

        updateFields.parentTeam = newParentTeamId;

        ConduitGrpcSdk.Logger.info(
          `Team ${teamId} parent switched from ${
            oldParentTeamId ?? 'none'
          } to ${newParentTeamId}`,
        );
      }

      const updatedTeam = await models.Team.getInstance().findByIdAndUpdate(
        teamId,
        updateFields,
      );

      if (!updatedTeam) {
        return callback({ code: status.INTERNAL, message: 'Failed to update team' });
      }

      if (oldRealmId) {
        const newRealm = await resolveTeamRealm(teamId);
        if (!newRealm || String(newRealm._id) !== oldRealmId) {
          // the team left its realm: same cleanup as when a sub-team is deleted
          await revokeOrphanedGuests(this.grpcSdk, oldRealmId, movedUserIds);
        }
      }

      if (name) {
        ConduitGrpcSdk.Logger.info(`Team ${teamId} name updated to ${name}`);
      }

      return callback(null, toGrpcTeam(updatedTeam));
    } catch (e) {
      return callback({
        code: e instanceof GrpcError ? e.code : status.INTERNAL,
        message: (e as Error).message,
      });
    }
  }

  private realmsAdmin() {
    return new RealmsAdmin(this.grpcSdk, () => this.refreshAppRoutes());
  }

  async setTeamRealm(
    call: GrpcRequest<SetTeamRealmRequest>,
    callback: GrpcCallback<RealmResponse>,
  ) {
    try {
      const params = buildSetRealmParams(call.request);
      const teamId = params.teamId as string;
      const team = await models.Team.getInstance().findOne({ _id: teamId });
      if (!team) {
        return callback({ code: status.NOT_FOUND, message: 'Team not found' });
      }
      const request = createParsedRouterRequest(params, { teamId }, undefined, params);
      const admin = this.realmsAdmin();
      // an existing realm is updated, anything else is promoted
      const realm = team.realm?.enabled
        ? await admin.updateRealm(request)
        : await admin.promote(request);
      return callback(
        null,
        toRealmResponse(realm as Parameters<typeof toRealmResponse>[0]),
      );
    } catch (e) {
      return callback(toCallbackError(e));
    }
  }

  async getRealmSettings(
    call: GrpcRequest<GetRealmSettingsRequest>,
    callback: GrpcCallback<RealmResponse>,
  ) {
    try {
      const teamId = assertTeamId(call.request.teamId);
      const request = createParsedRouterRequest({ teamId }, { teamId });
      const realm = await this.realmsAdmin().getRealm(request);
      return callback(
        null,
        toRealmResponse(realm as Parameters<typeof toRealmResponse>[0]),
      );
    } catch (e) {
      return callback(toCallbackError(e));
    }
  }

  async unsetTeamRealm(
    call: GrpcRequest<UnsetTeamRealmRequest>,
    callback: GrpcCallback<UnsetTeamRealmResponse>,
  ) {
    try {
      const teamId = assertTeamId(call.request.teamId);
      const force = call.request.force === true;
      const request = createParsedRouterRequest({ teamId, force }, { teamId }, { force });
      const result = (await this.realmsAdmin().demoteRealm(request)) as {
        message: string;
        blockedUsers: number;
      };
      return callback(null, {
        message: result.message,
        blockedUsers: result.blockedUsers,
      });
    } catch (e) {
      return callback(toCallbackError(e));
    }
  }

  async grantRealmMembership(
    call: GrpcRequest<RealmMembershipRequest>,
    callback: GrpcCallback<Empty>,
  ) {
    try {
      const teamId = assertTeamId(call.request.teamId);
      const userId = assertUserId(call.request.userId);
      const type = parseMembershipType(call.request.type);
      const force = call.request.force === true;
      const user = await models.User.getInstance().findOne({ _id: userId });
      if (!user) {
        return callback({ code: status.NOT_FOUND, message: 'User not found' });
      }
      assertGrantMembershipAllowed({
        type,
        realmTeamId: teamId,
        userHomeRealm: user.homeRealm,
        force,
      });
      const admin = this.realmsAdmin();
      if (type === 'guest') {
        const params = { teamId, userIds: [userId] };
        await admin.addGuests(
          createParsedRouterRequest(params, { teamId }, undefined, { userIds: [userId] }),
        );
      } else {
        // a home membership is the user's home realm
        const params = { id: userId, realmTeamId: teamId, force };
        await admin.moveUserHomeRealm(
          createParsedRouterRequest(params, { id: userId }, undefined, {
            realmTeamId: teamId,
            force,
          }),
        );
      }
      return callback(null, {});
    } catch (e) {
      return callback(toCallbackError(e));
    }
  }

  async revokeRealmMembership(
    call: GrpcRequest<RealmMembershipRequest>,
    callback: GrpcCallback<Empty>,
  ) {
    try {
      const teamId = assertTeamId(call.request.teamId);
      const userId = assertUserId(call.request.userId);
      parseOptionalMembershipType(call.request.type);
      // guests only: removing a home user is refused (HOME_USER_REMOVAL)
      await this.realmsAdmin().removeGuest(
        createParsedRouterRequest({ teamId, userId }, { teamId, userId }),
      );
      return callback(null, {});
    } catch (e) {
      return callback(toCallbackError(e));
    }
  }

  private startTokenCleanup() {
    if (this.tokenCleanupInterval) return;
    const cleanup = async () => {
      try {
        await models.AccessToken.getInstance().deleteMany({
          expiresOn: { $lte: new Date() },
        });
        await AuthUtils.cleanupExpiredUsers();
        await AuthUtils.reconcileLoggedInUsersMetric();
      } catch (e) {
        ConduitGrpcSdk.Logger.error(`Token cleanup failed: ${(e as Error).message}`);
      }
    };
    cleanup();
    this.tokenCleanupInterval = setInterval(cleanup, 5 * 60 * 1000);
  }

  private stopTokenCleanup() {
    if (this.tokenCleanupInterval) {
      clearInterval(this.tokenCleanupInterval);
      this.tokenCleanupInterval = null;
    }
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      //TODO: add support for multiple schemas types
      if (
        Object.keys((modelInstance as ConduitActiveSchema<typeof modelInstance>).fields)
          .length !== 0
      ) {
        // borrowed foreign model
        return this.database.createSchemaFromAdapter(modelInstance);
      }
    });
    return Promise.all(promises);
  }

  private refreshAppRoutes() {
    if (this.userRouter && !this.grpcSdk.isAvailable('router')) {
      return;
    }
    if (this.userRouter) {
      this.scheduleAppRouteRefresh();
      return;
    }
    if (!this.grpcSdk.isAvailable('router')) {
      return;
    }
    this.userRouter = new AuthenticationRoutes(this.grpcServer, this.grpcSdk);
    this.scheduleAppRouteRefresh();
  }

  private scheduleAppRouteRefresh() {
    if (this.refreshAppRoutesTimeout) {
      clearTimeout(this.refreshAppRoutesTimeout);
      this.refreshAppRoutesTimeout = null;
    }
    this.refreshAppRoutesTimeout = setTimeout(async () => {
      try {
        await this.userRouter.registerRoutes();
      } catch (err) {
        ConduitGrpcSdk.Logger.error(err as Error);
      }
      this.refreshAppRoutesTimeout = null;
    }, 800);
  }
}
