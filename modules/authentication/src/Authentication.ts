import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import { isEmpty, isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import AppConfigSchema, { Config } from './config/index.js';
import { AdminHandlers } from './admin/index.js';
import { AuthenticationRoutes } from './routes/index.js';
import * as models from './models/index.js';
import { AuthUtils } from './utils/index.js';
import { TokenType } from './constants/index.js';
import { v4 as uuid } from 'uuid';
import {
  AnonymousUserCreateRequest,
  CreateTeamRequest,
  GetTeamRequest,
  ModifyTeamMembersRequest,
  Team as GrpcTeam,
  TeamDeleteRequest,
  TeamDeleteResponse,
  UserChangePass,
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
import { configMigration } from './migrations/configMigration.js';
import {
  ConduitActiveSchema,
  ConfigController,
  createParsedRouterRequest,
  ManagedModule,
} from '@conduitplatform/module-tools';
import { TeamsAdmin } from './admin/team.js';
import { User as UserAuthz } from './authz/index.js';
import { handleAuthentication } from './routes/middleware.js';
import { fileURLToPath } from 'node:url';
import { TeamsHandler } from './handlers/team.js';
import { User } from './models/index.js';

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
      anonymousUserCreate: this.anonymousUserCreate.bind(this),
      changePass: this.changePass.bind(this),
      userDelete: this.userDelete.bind(this),
      getTeam: this.getTeam.bind(this),
      createTeam: this.createTeam.bind(this),
      teamDelete: this.teamDelete.bind(this),
      validateAccessToken: this.validateAccessToken.bind(this),
      addTeamMembers: this.addTeamMembers.bind(this),
      removeTeamMembers: this.removeTeamMembers.bind(this),
    },
  };
  protected metricsSchema = metricsSchema;
  private adminRouter: AdminHandlers;
  private userRouter: AuthenticationRoutes;
  private database: DatabaseProvider;
  private refreshAppRoutesTimeout: NodeJS.Timeout | null = null;
  private monitorsActive = false;

  constructor() {
    super('authentication');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.grpcSdk.onceModuleUp('authorization', async () => {
      await this.grpcSdk.authorization!.defineResource(UserAuthz);
    });
    this.database = this.grpcSdk.database!;
    TokenProvider.getInstance(this.grpcSdk);
    await this.registerSchemas();
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

  async preConfig(config: Config) {
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
    return config;
  }

  async onConfig() {
    const config = ConfigController.getInstance().config;
    if (config.redirectUris.allowAny && process.env.NODE_ENV === 'production') {
      ConduitGrpcSdk.Logger.warn(
        `Config option redirectUris.allowAny shouldn't be used in production!`,
      );
    }
    if (!config.active) {
      this.destroyMonitors();
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
      this.refreshAppRoutes();
      this.initMonitors();
      this.updateHealth(HealthCheckStatus.SERVING);
      if (config.local.verification.send_email) {
        if (!this.grpcSdk.isAvailable('email')) {
          ConduitGrpcSdk.Logger.warn(
            'Failed to enable email verification for local authentication strategy. Email module not serving.',
          );
        }
      }
    }
  }

  async preRegister(): Promise<void> {
    const config = await configMigration(this.grpcSdk);
    if (config) {
      this.config!.load(config);
      this.configOverride = true;
    }

    return super.preRegister();
  }

  initMonitors() {
    if (this.monitorsActive) return;
    this.monitorsActive = true;
    this.grpcSdk.monitorModule('email', async () => {
      this.refreshAppRoutes();
    });
    this.grpcSdk.monitorModule('authorization', async () => {
      this.refreshAppRoutes();
      this.adminRouter.registerAdminRoutes();
    });
    this.grpcSdk.monitorModule('sms', async () => {
      this.refreshAppRoutes();
    });
    this.grpcSdk.monitorModule('router', async () => {
      this.refreshAppRoutes();
    });
  }

  destroyMonitors() {
    if (!this.monitorsActive) return;
    this.monitorsActive = false;
    this.grpcSdk.unmonitorModule('email');
    this.grpcSdk.unmonitorModule('sms');
    this.grpcSdk.unmonitorModule('router');
  }

  async initializeMetrics() {
    // @improve-metrics
    // TODO: This should initialize 'logged_in_users_total' based on valid tokens
    // Gauge value should also decrease on latest token expiry.
  }

  // produces login credentials for a user without them having to login
  async userLogin(
    call: GrpcRequest<UserLoginRequest>,
    callback: GrpcCallback<UserLoginResponse>,
  ) {
    const { userId, clientId } = call.request;
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
      const tokens = await TokenProvider.getInstance().provideUserTokensInternal({
        user,
        clientId,
        config,
      });
      return callback(null, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? undefined,
      });
    } catch (e) {
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
    let password = call.request.password;
    const verify = call.request.verify;

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
    try {
      let user = await models.User.getInstance().findOne({ email });
      if (user) {
        return callback({ code: status.ALREADY_EXISTS, message: 'User already exists' });
      }
      if (AuthUtils.invalidEmailAddress(email)) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Invalid email address provided',
        });
      }
      const hashedPassword = await AuthUtils.hashPassword(password);
      const anonymousUserId = call.request.anonymousId;
      if (!anonymousUserId) {
        user = await models.User.getInstance().create({
          email,
          hashedPassword,
          isVerified: !verify,
        });
      } else {
        const config = ConfigController.getInstance().config;
        if (!config.anonymousUsers.enabled) {
          return callback({
            code: status.FAILED_PRECONDITION,
            message: 'Anonymous users configuration is disabled',
          });
        }
        user = await models.User.getInstance().findByIdAndUpdate(anonymousUserId, {
          email,
          hashedPassword,
          isAnonymous: false,
          isVerified: !verify,
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
        await this.grpcSdk.emailProvider!.sendEmail('EmailVerification', {
          email: user.email,
          variables: {
            link,
          },
        });
      } else if (verify) {
        ConduitGrpcSdk.Logger.error(
          'Failed to send verification email.' + ' Email service not online!',
        );
      }
      if (!anonymousUserId) {
        await TeamsHandler.getInstance()
          .addUserToDefault(user)
          .catch(err => {
            ConduitGrpcSdk.Logger.error(err);
          });
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
    const email = `${uuid()}@anonymous.com`;
    const anonymousUser = await User.getInstance().create({
      email,
      isAnonymous: true,
      isVerified: false,
    });
    await TeamsHandler.getInstance()
      .addUserToDefault(anonymousUser)
      .catch(err => {
        ConduitGrpcSdk.Logger.error(err);
      });
    const tokens = await TokenProvider.getInstance().provideUserTokensInternal({
      user: anonymousUser,
      clientId: clientId,
      config,
      isRefresh: false,
    });
    return callback(null, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? undefined,
    });
  }

  // produces login credentials for a user without them having to login
  async userDelete(
    call: GrpcRequest<UserDeleteRequest>,
    callback: GrpcCallback<UserDeleteResponse>,
  ) {
    const { userId } = call.request;
    try {
      await models.User.getInstance().deleteOne({ _id: userId });
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
      const user = await models.User.getInstance().findOne({ email });
      if (!user) {
        return callback({ code: status.NOT_FOUND, message: 'User not found' });
      }

      const hashedPassword = await AuthUtils.hashPassword(password);
      await models.User.getInstance().findByIdAndUpdate(user._id, {
        hashedPassword,
      });

      return callback(null, { password });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }

  async getTeam(call: GrpcRequest<GetTeamRequest>, callback: GrpcCallback<GrpcTeam>) {
    const request = createParsedRouterRequest(call.request);
    try {
      const team = (await new TeamsAdmin(this.grpcSdk).getTeam(request)) as
        | models.Team
        | undefined;
      if (!team) {
        return callback({ code: status.NOT_FOUND, message: 'Team not found' });
      }
      return callback(null, {
        id: team._id,
        name: team.name,
        parentTeam: team.parentTeam,
        isDefault: team.isDefault,
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
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
      return callback(null, {
        id: team._id,
        name: team.name,
        parentTeam: team.parentTeam,
        isDefault: team.isDefault,
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
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
    const accessStatus = await handleAuthentication(
      {},
      { authorization: `Bearer ${accessToken}` },
      {},
      path,
    )
      .then(r => {
        userId = (r.user as models.User)._id;
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
    return callback(null, { status: accessStatus, userId });
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
      TokenProvider.getInstance().deleteUserTokens({ user: id });
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
    const self = this;
    this.grpcSdk
      .waitForExistence('router')
      .then(() => {
        self.userRouter = new AuthenticationRoutes(self.grpcServer, self.grpcSdk);
        this.scheduleAppRouteRefresh();
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e.message);
      });
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
