import * as models from './models';
import { AccessToken, RefreshToken } from './models';
import { AdminHandlers } from './admin/admin';
import AuthenticationConfigSchema from './config';
import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitServiceModule,
  DatabaseProvider,
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import path from 'path';
import * as grpc from 'grpc';
import { AuthenticationRoutes } from './routes/Routes';
import { ConfigController } from './config/Config.controller';
import { ISignTokenOptions } from './interfaces/ISignTokenOptions';
import { AuthUtils } from './utils/auth';
import moment from 'moment';

export default class AuthenticationModule implements ConduitServiceModule {
  private database: DatabaseProvider;
  private _admin: AdminHandlers;
  private isRunning: boolean = false;
  private _router: AuthenticationRoutes;
  private grpcServer: GrpcServer;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  private _port: string;

  get port(): string {
    return this._port;
  }

  async initialize() {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './authentication.proto'),
      'authentication.Authentication',
      {
        setConfig: this.setConfig.bind(this),
        userLogin: this.userLogin.bind(this),
      }
    );
    this.grpcServer.start();
    console.log('Grpc server is online');
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database-provider');
    await this.grpcSdk.initializeEventBus();
    this.grpcSdk.bus!.subscribe('authentication', (message: string) => {
      if (message === 'config-update') {
        this.enableModule()
          .then(() => {
            console.log('Updated authentication configuration');
          })
          .catch(() => {
            console.log('Failed to update email config');
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
            console.log('Failed to update email config');
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
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid configuration values',
      });
    }

    let errorMessage: string | null = null;
    const authenticationConfig = await this.grpcSdk.config
      .updateConfig(newConfig, 'authentication')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    if (authenticationConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
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
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

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
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
    });
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
      this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
      await this.registerSchemas();
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
