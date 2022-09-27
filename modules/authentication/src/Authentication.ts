import ConduitGrpcSdk, {
  ManagedModule,
  ConfigController,
  DatabaseProvider,
  GrpcRequest,
  GrpcCallback,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import AppConfigSchema, { Config } from './config';
import { AdminHandlers } from './admin';
import { AuthenticationRoutes } from './routes';
import * as models from './models';
import { ISignTokenOptions } from './interfaces/ISignTokenOptions';
import { AuthUtils } from './utils/auth';
import { TokenType } from './constants/TokenType';
import { v4 as uuid } from 'uuid';
import moment from 'moment';
import {
  UserChangePass,
  UserCreateRequest,
  UserDeleteRequest,
  UserLoginRequest,
  UserLoginResponse,
  UserCreateResponse,
  UserDeleteResponse,
} from './protoTypes/authentication';
import { runMigrations } from './migrations';
import metricsSchema from './metrics';

export default class Authentication extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;
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
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
  }

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }

  async onConfig() {
    const config = ConfigController.getInstance().config;
    if (!config.active) {
      this.destroyMonitors();
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
      await this.refreshAppRoutes();
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

  initMonitors() {
    if (this.monitorsActive) return;
    this.monitorsActive = true;
    this.grpcSdk.monitorModule('email', async serving => {
      await this.refreshAppRoutes();
    });
    this.grpcSdk.monitorModule('sms', async serving => {
      await this.refreshAppRoutes();
    });
    this.grpcSdk.monitorModule('router', async serving => {
      await this.refreshAppRoutes();
    });
  }

  destroyMonitors() {
    if (!this.monitorsActive) return;
    this.monitorsActive = false;
    this.grpcSdk.unmonitorModule('email');
    this.grpcSdk.unmonitorModule('sms');
    this.grpcSdk.unmonitorModule('router');
  }

  private async refreshAppRoutes() {
    if (this.userRouter && this.grpcSdk.isAvailable('router')) {
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

  async initializeMetrics() {
    // @improve-metrics
    // TODO: This should initialize 'logged_in_users_total' based on valid tokens
    // Gauge value should also decrease on latest token expiry.
  }

  // gRPC Service
  // produces login credentials for a user without them having to login
  async userLogin(
    call: GrpcRequest<UserLoginRequest>,
    callback: GrpcCallback<UserLoginResponse>,
  ) {
    const { userId, clientId } = call.request;
    const config = ConfigController.getInstance().config;
    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod,
    };
    let errorMessage = null;
    const accessToken: models.AccessToken = await models.AccessToken.getInstance()
      .create({
        userId: userId,
        clientId,
        token: AuthUtils.signToken({ id: userId }, signTokenOptions),
        expiresOn: moment()
          .add(config.tokenInvalidationPeriod as number, 'milliseconds')
          .toDate(),
      })
      .catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    const refreshToken: models.RefreshToken = await models.RefreshToken.getInstance()
      .create({
        userId: userId,
        clientId,
        token: AuthUtils.randomToken(),
        expiresOn: moment()
          .add(config.refreshTokenInvalidationPeriod as number, 'milliseconds')
          .toDate(),
      })
      .catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
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
          userId: user._id,
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
      await models.User.getInstance().findByIdAndUpdate(
        user._id,
        {
          hashedPassword,
        },
        true,
      );

      return callback(null, { password });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }
}
