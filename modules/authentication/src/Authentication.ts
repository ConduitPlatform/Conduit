import * as models from './models';
import { AccessToken, RefreshToken, Token, User } from './models';
import { AdminHandlers } from './admin/admin';
import AuthenticationConfigSchema from './config';
import { isNil } from 'lodash';
import {
  ConduitServiceModule,
  DatabaseProvider,
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import path from 'path';
import { AuthenticationRoutes } from './routes/routes';
import { ConfigController } from './config/Config.controller';
import { ISignTokenOptions } from './interfaces/ISignTokenOptions';
import { AuthUtils } from './utils/auth';
import moment from 'moment';
import { status } from '@grpc/grpc-js';
import { TokenType } from './constants/TokenType';
import { v4 as uuid } from 'uuid';
import randomToken = AuthUtils.randomToken;

export default class AuthenticationModule extends ConduitServiceModule {
  private database: DatabaseProvider;
  private _admin: AdminHandlers;
  private isRunning: boolean = false;
  private _router: AuthenticationRoutes;

  async initialize(servicePort?: string) {
    this.grpcServer = new GrpcServer(servicePort);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './authentication.proto'),
      'authentication.Authentication',
      {
        setConfig: this.setConfig.bind(this),
        userLogin: this.userLogin.bind(this),
        userCreate: this.userCreate.bind(this),
        changePass: this.changePass.bind(this),
        userDelete: this.userDelete.bind(this),
      }
    );
    this.grpcServer.start();
    console.log('Grpc server is online');
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database');
    await this.grpcSdk.initializeEventBus();
    this.grpcSdk.bus!.subscribe('authentication', (message: string) => {
      if (message === 'config-update') {
        this.enableModule()
          .then(() => {
            console.log('Updated authentication configuration');
          })
          .catch(() => {
            console.log('Failed to update authentication config');
          });
      }
    });
    this.grpcSdk.bus!.subscribe('email-provider', (message: string) => {
      if (message === 'enabled') {
        this.enableModule()
          .then(() => {
            console.log('Updated authentication configuration');
          })
          .catch(() => {
            console.log('Failed to update authentication config');
          });
      }
    });
    let config;
    try {
      await this.grpcSdk.config.get('authentication');
    } catch (e) {
      await this.grpcSdk.config.updateConfig(
        AuthenticationConfigSchema.getProperties(),
        'authentication'
      );
    }

    config = await this.grpcSdk.config.addFieldstoConfig(
      AuthenticationConfigSchema.getProperties(),
      'authentication'
    );
    if (config.active) await this.enableModule();
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    const newConfig = JSON.parse(call.request.newConfig);
    try {
      AuthenticationConfigSchema.load(newConfig).validate();
    } catch (e) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid configuration values',
      });
    }

    let errorMessage: string | null = null;
    const authenticationConfig = await this.grpcSdk.config
      .updateConfig(newConfig, 'authentication')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    if (authenticationConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish('authentication', 'config-update');
    } else {
      await this.updateConfig(authenticationConfig).catch(() => {
        console.log('Failed to update config');
      });
      this.grpcSdk.bus?.publish('authentication', 'config-update');
    }

    return callback(null, { updatedConfig: JSON.stringify(authenticationConfig) });
  }

  // produces login credentials for a user without them having to login
  async userLogin(call: any, callback: any) {
    const { userId, clientId } = call.request;
    let config = ConfigController.getInstance().config;
    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod,
    };
    let errorMessage = null;
    const accessToken: AccessToken = await AccessToken.getInstance()
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

    const refreshToken = await RefreshToken.getInstance()
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

  // produces login credentials for a user without them having to login
  async userDelete(call: any, callback: any) {
    const { userId } = call.request;
    try {
      await User.getInstance().deleteOne({ _id: userId });
      return callback(null, {
        message: 'ok',
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: e.message });
    }
  }

  async userCreate(call: any, callback: any) {
    const email = call.request.email;
    let password = call.request.password;
    let verify = call.request.verify;
    if (isNil(password) || password.length === 0) {
      password = randomToken(8);
    }
    try {
      let usr = await User.getInstance().findOne({ email });
      if (usr) {
        return callback({ code: status.ALREADY_EXISTS, message: 'User already exists' });
      }
      if (email.indexOf('+') !== -1) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Email contains unsupported characters',
        });
      }
      let hashedPassword = await AuthUtils.hashPassword(password);
      let user = await User.getInstance().create({
        email,
        hashedPassword,
        isVerified: !verify,
      });

      // if verification is required
      if (verify) {
        let serverConfig = await this.grpcSdk.config.getServerConfig();
        let url = serverConfig.url;
        let verificationToken: Token = await Token.getInstance().create({
          type: TokenType.VERIFICATION_TOKEN,
          userId: user._id,
          token: uuid(),
        });
        let result = { verificationToken, hostUrl: url };
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

  async changePass(call: any, callback: any) {
    const email = call.request.email;
    let password = call.request.password;
    if (isNil(password) || password.length === 0) {
      password = randomToken(8);
    }
    try {
      let usr = await User.getInstance().findOne({ email });
      if (!usr) {
        return callback({ code: status.NOT_FOUND, message: 'User not found' });
      }

      let hashedPassword = await AuthUtils.hashPassword(password);
      await User.getInstance().findByIdAndUpdate(
        usr._id,
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

  private updateConfig(config?: any) {
    if (config) {
      ConfigController.getInstance().config = config;
      return Promise.resolve();
    } else {
      return this.grpcSdk.config.get('authentication').then((config: any) => {
        ConfigController.getInstance().config = config;
      });
    }
  }

  private async enableModule() {
    await this.updateConfig();
    if (!this.isRunning) {
      this.database = this.grpcSdk.databaseProvider!;
      await this.registerSchemas();
      this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
      this._router = new AuthenticationRoutes(this.grpcServer, this.grpcSdk);
      this.isRunning = true;
    }
    await this._router.registerRoutes();
  }

  private registerSchemas() {
    // @ts-ignore
    const promises = Object.values(models).map((model: any) => {
      let modelInstance = model.getInstance(this.database);
      return this.database.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }
}
