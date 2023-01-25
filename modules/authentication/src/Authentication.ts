import ConduitGrpcSdk, {
  ConduitActiveSchema,
  ConfigController,
  DatabaseProvider,
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
  ManagedModule,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import AppConfigSchema, { Config } from './config';
import { AdminHandlers } from './admin';
import { AuthenticationRoutes } from './routes';
import * as models from './models';
import { AuthUtils } from './utils';
import { TokenType } from './constants/TokenType';
import { v4 as uuid } from 'uuid';
import {
  UserChangePass,
  UserCreateRequest,
  UserCreateResponse,
  UserDeleteRequest,
  UserDeleteResponse,
  UserLoginRequest,
  UserLoginResponse,
} from './protoTypes/authentication';
import { runMigrations } from './migrations';
import metricsSchema from './metrics';
import { TokenProvider } from './handlers/tokenProvider';
import { configMigration } from './migrations/configMigration';

export default class Authentication extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'authentication.proto'),
    protoDescription: 'authentication.Authentication',
    functions: {
      setConfig: this.setConfig.bind(this),
      userLogin: this.userLogin.bind(this),
      userCreate: this.userCreate.bind(this),
      changePass: this.changePass.bind(this),
      userDelete: this.userDelete.bind(this),
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
    this.database = this.grpcSdk.database!;
    TokenProvider.getInstance(this.grpcSdk);
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
  }

  async preConfig(config: Config) {
    if (
      config.accessTokens.cookieOptions.maxAge > config.accessTokens.expiryPeriod ||
      config.refreshTokens.cookieOptions.maxAge > config.refreshTokens.expiryPeriod
    ) {
      throw new Error(
        'Invalid configuration: *.cookieOptions.maxAge should not exceed *.expiryPeriod',
      );
    }
    return config;
  }

  async onConfig() {
    const config = ConfigController.getInstance().config;
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
    const config = ConfigController.getInstance().config;

    const tokens = await TokenProvider.getInstance().provideUserTokensInternal({
      user,
      clientId,
      config,
    });

    return callback(null, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? undefined,
    });
  }

  async userCreate(
    call: GrpcRequest<UserCreateRequest>,
    callback: GrpcCallback<UserCreateResponse>,
  ) {
    const email = call.request.email;
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
      user = await models.User.getInstance().create({
        email,
        hashedPassword,
        isVerified: !verify,
      });
      const sendEmail =
        ConfigController.getInstance().config.local.verification.send_email;
      const emailAvailable = this.grpcSdk.isAvailable('email');
      if (verify && sendEmail && emailAvailable) {
        const serverConfig = await this.grpcSdk.config.get('router');
        const url = serverConfig.hostUrl;
        const verificationToken: models.Token = await models.Token.getInstance().create({
          type: TokenType.VERIFICATION_TOKEN,
          user: user._id,
          token: uuid(),
        });
        const result = { verificationToken, hostUrl: url };
        const link = `${result.hostUrl}/hook/authentication/verify-email/${result.verificationToken.token}`;
        await this.grpcSdk.emailProvider!.sendEmail('EmailVerification', {
          email: user.email,
          sender: 'no-reply',
          variables: {
            link,
          },
        });
      } else if (verify) {
        ConduitGrpcSdk.Logger.error(
          'Failed to send verification email.' + ' Email service not online!',
        );
      }
      return callback(null, { password });
    } catch (e) {
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
    const email = call.request.email;
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
