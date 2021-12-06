import * as models from './models';
import { AdminHandlers } from './admin/admin';
import FormsConfigSchema from './config';
import { isNil } from 'lodash';
import {
  ConduitServiceModule,
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import path from 'path';
import { FormRoutes } from './routes/Routes';
import { FormsController } from './controllers/forms.controller';
import { FormSubmissionTemplate } from './templates';
import { status } from '@grpc/grpc-js';

export default class FormsModule extends ConduitServiceModule {
  private database: any;
  private _admin: AdminHandlers;
  private isRunning: boolean = false;
  private _router: FormRoutes;
  private _formController: FormsController;

  async initialize() {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './forms.proto'),
      'forms.Forms',
      {
        setConfig: this.setConfig.bind(this),
      }
    );
    this.grpcServer.start();
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database_provider');
    await this.grpcSdk.waitForExistence('email');
    await this.grpcSdk.initializeEventBus();

    this.grpcSdk.bus?.subscribe('forms', (message: string) => {
      if (message === 'config-update') {
        this.enableModule()
          .then(() => {
            console.log('Updated forms configuration');
          })
          .catch(() => {
            console.log('Failed to update forms config');
          });
      }
    });
    this.grpcSdk.bus?.subscribe('email-provider', (message: string) => {
      if (message === 'enabled') {
        this.enableModule()
          .then(() => {
            console.log('Updated forms configuration');
          })
          .catch(() => {
            console.log('Failed to update forms config');
          });
      }
    });
    try {
      await this.grpcSdk.config.get('forms');
    } catch (e) {
      await this.grpcSdk.config.updateConfig(FormsConfigSchema.getProperties(), 'forms');
    }
    let config = await this.grpcSdk.config.addFieldstoConfig(
      FormsConfigSchema.getProperties(),
      'forms'
    );
    if (config.active) await this.enableModule();
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    const newConfig = JSON.parse(call.request.newConfig);
    try {
      FormsConfigSchema.load(newConfig).validate();
    } catch (e) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid configuration values',
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'forms')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    const formsConfig = await this.grpcSdk.config.get('forms');
    if (formsConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish('forms', 'config-update');
    } else {
      return callback({
        code: status.FAILED_PRECONDITION,
        message: 'Module is not active',
      });
    }
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  private async enableModule() {
    if (!this.isRunning) {
      this.database = this.grpcSdk.databaseProvider;
      await this.registerSchemas();
      await this.grpcSdk.emailProvider!.registerTemplate(FormSubmissionTemplate);
      this._router = new FormRoutes(this.grpcServer, this.grpcSdk);
      this._formController = new FormsController(this.grpcSdk, this._router);
      this._admin = new AdminHandlers(
        this.grpcServer,
        this.grpcSdk,
        this._formController
      );
      this.isRunning = true;
    }
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model: any) => {
      let modelInstance = model.getInstance(this.database);
      return this.database.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }
}
