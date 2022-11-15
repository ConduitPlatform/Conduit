import ConduitGrpcSdk, {
  ManagedModule,
  ConfigController,
  DatabaseProvider,
  HealthCheckStatus,
  GrpcRequest,
  GrpcCallback,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import AppConfigSchema from './config';
import { AdminHandlers } from './admin';
import { EmailService } from './services/email.service';
import { EmailProvider } from './email-provider';
import * as models from './models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { Config } from './config';
import { runMigrations } from './migrations';
import {
  RegisterTemplateRequest,
  RegisterTemplateResponse,
  SendEmailRequest,
  SendEmailResponse,
} from './protoTypes/email';
import metricsSchema from './metrics';

export default class Email extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  protected metricsSchema = metricsSchema;
  service = {
    protoPath: path.resolve(__dirname, 'email.proto'),
    protoDescription: 'email.Email',
    functions: {
      registerTemplate: this.registerTemplate.bind(this),
      sendEmail: this.sendEmail.bind(this),
    },
  };
  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;
  private database: DatabaseProvider;
  private emailProvider: EmailProvider;
  private emailService: EmailService;

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

  protected registerSchemas() {
    const promises = Object.values(models).map(model => {
      const modelInstance = model.getInstance(this.database);
      return this.database.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }

  async preConfig(config: Config) {
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
      if (!this.isRunning) {
        await this.initEmailProvider();
        this.emailService = new EmailService(this.emailProvider);
        this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
        this.adminRouter.setEmailService(this.emailService);
        this.isRunning = true;
      } else {
        await this.initEmailProvider(ConfigController.getInstance().config);
        this.emailService.updateProvider(this.emailProvider);
      }
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  private async initEmailProvider(newConfig?: Config) {
    const emailConfig = !isNil(newConfig)
      ? newConfig
      : await this.grpcSdk.config.get('email');

    const { transport, transportSettings } = emailConfig;

    this.emailProvider = new EmailProvider(transport, transportSettings);
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
    };
    let errorMessage: string | null = null;
    const template = await this.emailService
      .registerTemplate(params)
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
    const params = {
      email: call.request.params!.email,
      variables: JSON.parse(call.request.params!.variables),
      sender: call.request.params!.sender,
      cc: call.request.params!.cc,
      replyTo: call.request.params!.replyTo,
      attachments: call.request.params!.attachments,
    };
    const emailConfig: Config = await this.grpcSdk.config
      .get('email')
      .catch(() => ConduitGrpcSdk.Logger.error('Failed to get sending domain'));
    params.sender = params.sender + `@${emailConfig?.sendingDomain ?? 'conduit.com'}`;
    let errorMessage: string | null = null;
    const sentMessageInfo = await this.emailService
      .sendEmail(template, params)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, { sentMessageInfo });
  }
}
