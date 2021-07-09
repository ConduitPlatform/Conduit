import * as models from './models';
import { AdminHandlers } from './admin/admin';
import AuthenticationConfigSchema from './config';
import { isNil } from 'lodash';
import ConduitGrpcSdk, {
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

export default class AuthenticationModule {
  private database: any;
  private _admin: AdminHandlers;
  private isRunning: boolean = false;
  private _router: AuthenticationRoutes;
  private readonly grpcServer: GrpcServer;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._url = this.grpcServer.url;
    this.grpcServer
      .addService(
        path.resolve(__dirname, './authentication.proto'),
        'authentication.Authentication',
        {
          setConfig: this.setConfig.bind(this),
          userLogin: this.userLogin.bind(this),
        }
      )
      .then(() => {
        return this.grpcServer.start();
      })
      .then(() => {
        console.log('Grpc server is online');
      })
      .catch((err: Error) => {
        console.log('Failed to initialize server');
        console.error(err);
        process.exit(-1);
      });

    this.grpcSdk
      .waitForExistence('database-provider')
      .then(() => {
        return this.grpcSdk.initializeEventBus();
      })
      .then(() => {
        this.grpcSdk.bus?.subscribe('authentication', (message: string) => {
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
        this.grpcSdk.bus?.subscribe('email-provider', (message: string) => {
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
      })
      .catch(() => {
        console.log('Bus did not initialize!');
      })
      .then(() => {
        return this.grpcSdk.config.get('authentication');
      })
      .catch(() => {
        return this.grpcSdk.config.updateConfig(
          AuthenticationConfigSchema.getProperties(),
          'authentication'
        );
      })
      .then(() => {
        return this.grpcSdk.config.addFieldstoConfig(
          AuthenticationConfigSchema.getProperties(),
          'authentication'
        );
      })
      .catch(() => {
        console.log('authentication config did not update');
      })
      .then((authConfig: any) => {
        if (authConfig.active) {
          return this.enableModule();
        }
      })
      .catch(console.log);
  }

  private _url: string;

  get url(): string {
    return this._url;
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
    const accessToken = await this.database
      .create('AccessToken', {
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

    const refreshToken = await this.database
      .create('RefreshToken', {
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
      this.database = this.grpcSdk.databaseProvider;
      this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
      await this.registerSchemas();
      this._router = new AuthenticationRoutes(this.grpcServer, this.grpcSdk);
      this.isRunning = true;
    }
    await this._router.registerRoutes();
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model) => {
      return this.database.createSchemaFromAdapter(model);
    });
    return Promise.all(promises);
  }
}
