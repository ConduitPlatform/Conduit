import {
  ManagedModule,
  ConfigController,
  DatabaseProvider,
} from '@conduitplatform/grpc-sdk';

import path from 'path';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import AppConfigSchema from './config';
import { AdminHandlers } from './admin/admin';
import { AuthenticationRoutes } from './routes/routes';
import * as models from './models';
import { ISignTokenOptions } from './interfaces/ISignTokenOptions';
import { AuthUtils } from './utils/auth';
import { TokenType } from './constants/TokenType';
import { v4 as uuid } from 'uuid';
import moment from 'moment';
import { migrateLocalAuthConfig } from './migrations/localAuthConfig.migration';

export default class Authentication extends ManagedModule {
  config = AppConfigSchema;
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
  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;
  private userRouter: AuthenticationRoutes;
  private database: DatabaseProvider;

  constructor() {
    super('authentication');
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.databaseProvider!;
    await migrateLocalAuthConfig(this.grpcSdk);
  }

  async onRegister() {
    this.grpcSdk.bus!.subscribe('email:status:activated', (message: string) => {
      if (message === 'enabled') {
        this.onConfig()
          .then(() => {
            console.log('Updated authentication configuration');
          })
          .catch(() => {
            console.log('Failed to update authentication config');
          });
      }
    });
  }

  protected registerSchemas() {
    // @ts-ignore
    const promises = Object.values(models).map((model: any) => {
      const modelInstance = model.getInstance(this.database);
      return this.database.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }

  async onConfig() {
    if (!this.isRunning) {
      await this.registerSchemas();
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
      this.userRouter = new AuthenticationRoutes(this.grpcServer, this.grpcSdk);
      this.isRunning = true;
    }
    await this.userRouter.registerRoutes();
  }

  // gRPC Service
  // produces login credentials for a user without them having to login
  async userLogin(call: any, callback: any) {
    const { userId, clientId } = call.request;
    let config = ConfigController.getInstance().config;
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
      .catch((e: any) => (errorMessage = e.message));
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
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
    });
  }

  async userCreate(call: any, callback: any) {
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

      // if verification is required
      if (verify) {
        const serverConfig = await this.grpcSdk.config.getServerConfig();
        const url = serverConfig.url;
        const verificationToken: models.Token = await models.Token.getInstance()
          .create({
            type: TokenType.VERIFICATION_TOKEN,
            userId: user._id,
            token: uuid(),
          })
        const result = { verificationToken, hostUrl: url };
        const link = `${result.hostUrl}/hook/authentication/verify-email/${result.verificationToken.token}`;
        await this.grpcSdk.emailProvider!.sendEmail('EmailVerification', {
          email: user.email,
          sender: 'no-reply',
          variables: {
            link,
          },
        });
      }

      return callback(null, { password });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: e.message });
    }
  }

  // produces login credentials for a user without them having to login
  async userDelete(call: any, callback: any) {
    const { userId } = call.request;
    try {
      await models.User.getInstance().deleteOne({ _id: userId });
      return callback(null, {
        message: 'ok',
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: e.message });
    }
  }

  async changePass(call: any, callback: any) {
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
        true
      );

      return callback(null, { password });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: e.message });
    }
  }
}
