import { emailTemplateSchema } from './models/EmailTemplate';
import { EmailProvider } from '@quintessential-sft/email-provider';
import { EmailService } from './services/email.service';
import { AdminHandlers } from './admin/AdminHandlers';
import EmailConfigSchema from './config';
import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  GrpcServer,
  GrpcRequest,
  GrpcResponse,
  SetConfigRequest,
  SetConfigResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import path from 'path';
import * as grpc from 'grpc';

type RegisterTemplateRequest = GrpcRequest<{
  name: string,
  subject: string,
  body: string,
  variables: string[]
}>;
type RegisterTemplateResponse = GrpcResponse<{ template: string }>;

type SendEmailRequest = GrpcRequest<{
  templateName: string,
  params: {
    email: string,
    variables: string,
    sender: string,
    cc: string[],
    replyTo: string,
    attachments: string[],
  }
}>;
type SendEmailResponse = GrpcResponse<{ sentMessageInfo: string }>;

export default class EmailModule {
  private emailProvider: EmailProvider;
  private emailService: EmailService;
  private adminHandlers: AdminHandlers;
  private isRunning: boolean = false;
  private _url: string;
  private readonly grpcServer: GrpcServer;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._url = this.grpcServer.url;
    this.grpcServer
      .addService(path.resolve(__dirname, './email.proto'), 'email.Email', {
        setConfig: this.setConfig.bind(this),
        registerTemplate: this.registerTemplate.bind(this),
        sendEmail: this.sendEmail.bind(this),
      })
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

    this.adminHandlers = new AdminHandlers(this.grpcServer, this.grpcSdk);

    this.grpcSdk
      .waitForExistence('database-provider')
      .then(() => {
        return this.grpcSdk.initializeEventBus();
      })
      .then(() => {
        this.grpcSdk.bus?.subscribe('email-provider', (message: string) => {
          if (message === 'config-update') {
            this.enableModule()
              .then(() => {
                console.log('Update email configuration');
              })
              .catch(() => {
                console.log('Failed to update email config');
              });
          }
        });
      })
      .catch(() => {
        console.log('Bus did not initialize');
      })
      .then(() => {
        return this.grpcSdk.config.get('email');
      })
      .catch(() => {
        return this.grpcSdk.config.updateConfig(
          EmailConfigSchema.getProperties(),
          'email'
        );
      })
      .then(() => {
        return this.grpcSdk.config.addFieldstoConfig(
          EmailConfigSchema.getProperties(),
          'email'
        );
      })
      .catch(() => {
        console.log('email config did not update');
      })
      .then((emailConfig: any) => {
        if (emailConfig.active) {
          return this.enableModule();
        }
      })
      .catch(console.log);
  }

  get url(): string {
    return this._url;
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    const newConfig = JSON.parse(call.request.newConfig);
    if (
      isNil(newConfig.active) ||
      isNil(newConfig.transport) ||
      isNil(newConfig.transportSettings)
    ) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid configuration given',
      });
    }
    if (!EmailConfigSchema.load(newConfig).validate()) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid configuration given',
      });
    }

    let errorMessage: string | null = null;
    let updateResult = null;

    if (newConfig.active) {
      await this.enableModule(newConfig).catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      updateResult = await this.grpcSdk.config
        .updateConfig(newConfig, 'email')
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish('email-provider', 'config-update');
    } else {
      return callback({
        code: grpc.status.FAILED_PRECONDITION,
        message: 'Module must be activated to set config',
      });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  private async enableModule(newConfig?: any) {
    if (!this.isRunning) {
      this.registerModels();
      await this.initEmailProvider();
      this.emailService = new EmailService(this.emailProvider, this.grpcSdk);
      this.adminHandlers.setEmailService(this.emailService);
      this.isRunning = true;
      this.grpcSdk.bus?.publish('email-provider', 'enabled');
    } else {
      await this.initEmailProvider(newConfig);
      this.emailService.updateProvider(this.emailProvider);
    }
  }

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
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
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
    let emailConfig: any = await this.grpcSdk.config
      .get('email')
      .catch(() => console.log('failed to get sending domain'));
    params.sender = params.sender + `@${emailConfig?.sendingDomain ?? 'conduit.com'}`;
    let errorMessage: string | null = null;
    const sentMessageInfo = await this.emailService
      .sendEmail(template, params)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    return callback(null, { sentMessageInfo });
  }

  private registerModels() {
    const database = this.grpcSdk.databaseProvider;
    database!.createSchemaFromAdapter(emailTemplateSchema);
  }

  private async initEmailProvider(newConfig?: any) {
    let emailConfig = !isNil(newConfig)
      ? newConfig
      : await this.grpcSdk.config.get('email');

    let { transport, transportSettings } = emailConfig;

    this.emailProvider = new EmailProvider(transport, transportSettings);
  }
}
