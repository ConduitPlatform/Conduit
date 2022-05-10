import {
  ManagedModule,
  ConfigController,
  DatabaseProvider,
  GrpcRequest,
  GrpcResponse,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import AppConfigSchema from './config';
import { AdminHandlers } from './admin/admin';
import { EmailService } from './services/email.service';
import { EmailProvider } from './email-provider';
import * as models from './models';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { Config } from './interfaces/Config';

type RegisterTemplateRequest = GrpcRequest<{
  name: string;
  subject: string;
  body: string;
  variables: string[];
}>;
type RegisterTemplateResponse = GrpcResponse<{ template: string }>;

type SendEmailRequest = GrpcRequest<{
  templateName: string;
  params: {
    email: string;
    variables: string;
    sender: string;
    cc: string[];
    replyTo: string;
    attachments: string[];
  };
}>;
type SendEmailResponse = GrpcResponse<{ sentMessageInfo: string }>;

export default class Email extends ManagedModule {
  config = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'email.proto'),
    protoDescription: 'email.Email',
    functions: {
      setConfig: this.setConfig.bind(this),
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
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.databaseProvider!;
  }

  protected registerSchemas() {
    const promises = Object.values(models).map((model: any) => {
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
    if (!this.isRunning) {
      await this.registerSchemas();
      await this.initEmailProvider();
      this.emailService = new EmailService(this.emailProvider, this.grpcSdk);
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
      this.adminRouter.setEmailService(this.emailService);
      this.isRunning = true;
    } else {
      await this.initEmailProvider(ConfigController.getInstance().config);
      this.emailService.updateProvider(this.emailProvider);
    }
    this.grpcSdk.bus?.publish(
      'email:status:onConfig',
      this.isRunning ? 'active' : 'inactive',
    );
  }

  private async initEmailProvider(newConfig?: Config) {
    let emailConfig = !isNil(newConfig)
      ? newConfig
      : await this.grpcSdk.config.get('email');

    let { transport, transportSettings } = emailConfig;

    this.emailProvider = new EmailProvider(transport, transportSettings);
  }

  // gRPC Service
  async registerTemplate(call: RegisterTemplateRequest, callback: RegisterTemplateResponse) {
    const params = {
      name: call.request.name,
      subject: call.request.subject,
      body: call.request.body,
      variables: call.request.variables,
    };
    let errorMessage: string | null = null;
    const template = await this.emailService
      .registerTemplate(params)
      .catch((e) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, { template: JSON.stringify(template) });
  }

  async sendEmail(call: SendEmailRequest, callback: SendEmailResponse) {
    const template = call.request.templateName;
    const params = {
      email: call.request.params.email,
      variables: JSON.parse(call.request.params.variables),
      sender: call.request.params.sender,
      cc: call.request.params.cc,
      replyTo: call.request.params.replyTo,
      attachments: call.request.params.attachments,
    };
    let emailConfig: Config = await this.grpcSdk.config
      .get('email')
      .catch(() => console.log('failed to get sending domain'));
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
