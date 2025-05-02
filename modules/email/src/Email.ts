import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import AppConfigSchema, { Config } from './config/index.js';
import { AdminHandlers } from './admin/index.js';
import { EmailService } from './services/email.service.js';
import { EmailProvider } from './email-provider/index.js';
import * as models from './models/index.js';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { runMigrations } from './migrations/index.js';
import {
  GetEmailStatusRequest,
  GetEmailStatusResponse,
  RegisterTemplateRequest,
  RegisterTemplateResponse,
  ResendEmailRequest,
  ResendEmailResponse,
  SendEmailRequest,
  SendEmailResponse,
  UpdateTemplateRequest,
} from './protoTypes/email.js';
import metricsSchema from './metrics/index.js';
import { ConfigController, ManagedModule } from '@conduitplatform/module-tools';
import { ISendEmailParams } from './interfaces/index.js';
import { fileURLToPath } from 'node:url';

import { QueueController } from './controllers/queue.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Email extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'email.proto'),
    protoDescription: 'email.Email',
    functions: {
      registerTemplate: this.registerTemplate.bind(this),
      updateTemplate: this.updateTemplate.bind(this),
      sendEmail: this.sendEmail.bind(this),
      resendEmail: this.resendEmail.bind(this),
      getEmailStatus: this.getEmailStatus.bind(this),
    },
  };
  protected metricsSchema = metricsSchema;
  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;
  private database: DatabaseProvider;
  private emailProvider: EmailProvider;
  private emailService: EmailService;
  private queueController: QueueController;

  constructor() {
    super('email');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
  }

  async preConfig(config: Config) {
    if (config.transportSettings?.sendgrid.hasOwnProperty('apiUser')) {
      delete (
        config as Config & { transportSettings: { sendgrid: { apiUser?: string } } }
      ).transportSettings.sendgrid.apiUser;
    }
    if (
      isNil(config.active) ||
      isNil(config.transport) ||
      isNil(config.transportSettings)
    ) {
      throw new Error('Invalid configuration given');
    }
    return config;
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      const config = ConfigController.getInstance().config as Config;
      if (config.storeEmails.storage.enabled && !this.grpcSdk.isAvailable('storage')) {
        ConduitGrpcSdk.Logger.warn(
          'Failed to enable email storing. Storage module not serving.',
        );
      }
      if (!this.isRunning) {
        await this.initEmailProvider();
        this.emailService = new EmailService(this.grpcSdk, this.emailProvider);
        this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
        this.adminRouter.setEmailService(this.emailService);
        if (config.storeEmails.enabled) {
          this.queueController = QueueController.getInstance(this.grpcSdk);
          this.queueController.addEmailStatusWorker();
          if (config.storeEmails.cleanupSettings.enabled) {
            this.queueController.addEmailCleanupWorker();
            await this.queueController.drainEmailCleanupQueue();
            await this.queueController.addEmailCleanupJob(
              config.storeEmails.cleanupSettings.limit,
              config.storeEmails.storage.enabled,
              config.storeEmails.cleanupSettings.repeat,
            );
          }
        }
        this.isRunning = true;
      } else {
        await this.initEmailProvider(ConfigController.getInstance().config);
        this.emailService.updateProvider(this.emailProvider);
      }
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  async initializeMetrics() {
    const templatesTotal = await models.EmailTemplate.getInstance().countDocuments({});
    ConduitGrpcSdk.Metrics?.set('email_templates_total', templatesTotal);
  }

  // gRPC Service
  async registerTemplate(
    call: GrpcRequest<RegisterTemplateRequest>,
    callback: GrpcCallback<RegisterTemplateResponse>,
  ) {
    const params = {
      name: call.request.name,
      subject: call.request.subject,
      body: call.request.body,
      variables: call.request.variables,
      sender: call.request.sender,
    };
    let errorMessage: string | null = null;
    const template = await this.emailService
      .registerTemplate(params)
      .catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, { template: JSON.stringify(template) });
  }

  async updateTemplate(
    call: GrpcRequest<UpdateTemplateRequest>,
    callback: GrpcCallback<RegisterTemplateResponse>,
  ) {
    const params = {
      name: call.request.name,
      subject: call.request.subject,
      body: call.request.body,
      variables: call.request.variables,
      sender: call.request.sender,
    };
    let errorMessage: string | null = null;
    const { template } = await this.emailService
      .updateTemplate(call.request.id, params)
      .catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, { template: JSON.stringify(template) });
  }

  async sendEmail(
    call: GrpcRequest<SendEmailRequest>,
    callback: GrpcCallback<SendEmailResponse>,
  ) {
    const template = call.request.templateName;
    const params: ISendEmailParams = {
      email: call.request.params!.email,
      variables: JSON.parse(call.request.params!.variables),
      sender: call.request.params!.sender ?? '',
      cc: call.request.params!.cc,
      replyTo: call.request.params!.replyTo,
      attachments: call.request.params!.attachments,
    };

    let errorMessage: string | null = null;

    const sentMessageInfo = await this.emailService
      .sendEmail(template, params)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, { sentMessageInfo });
  }

  async resendEmail(
    call: GrpcRequest<ResendEmailRequest>,
    callback: GrpcCallback<ResendEmailResponse>,
  ) {
    let errorMessage: string | null = null;
    const sentMessageInfo = await this.emailService
      .resendEmail(call.request.emailRecordId)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, { sentMessageInfo });
  }

  async getEmailStatus(
    call: GrpcRequest<GetEmailStatusRequest>,
    callback: GrpcCallback<GetEmailStatusResponse>,
  ) {
    let errorMessage: string | null = null;
    const statusInfo = await this.emailService
      .getEmailStatus(call.request.messageId)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, { statusInfo: JSON.stringify(statusInfo) });
  }

  protected registerSchemas(): Promise<unknown> {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database
        .createSchemaFromAdapter(modelInstance)
        .then(() => this.database.migrate(modelInstance.name));
    });
    return Promise.all(promises);
  }

  private async initEmailProvider(newConfig?: Config) {
    const emailConfig = !isNil(newConfig)
      ? newConfig
      : await this.grpcSdk.config.get('email');

    const { transport, transportSettings } = emailConfig;

    this.emailProvider = new EmailProvider(transport, transportSettings);
  }
}
