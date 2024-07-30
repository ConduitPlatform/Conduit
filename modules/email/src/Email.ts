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
} from './protoTypes/email.js';
import metricsSchema from './metrics/index.js';
import { ConfigController, ManagedModule } from '@conduitplatform/module-tools';
import { ISendEmailParams } from './interfaces/index.js';
import { fileURLToPath } from 'node:url';
import { Queue, Worker } from 'bullmq';
import { Cluster, Redis } from 'ioredis';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Email extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'email.proto'),
    protoDescription: 'email.Email',
    functions: {
      registerTemplate: this.registerTemplate.bind(this),
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
  private redisConnection: Redis | Cluster;
  private emailCleanupQueue: Queue | null = null;

  constructor() {
    super('email');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
    this.redisConnection = this.grpcSdk.redisManager.getClient();
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
        this.emailService = new EmailService(this.grpcSdk, this.emailProvider);
        this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
        this.adminRouter.setEmailService(this.emailService);
        this.isRunning = true;
      } else {
        await this.initEmailProvider(ConfigController.getInstance().config);
        this.emailService.updateProvider(this.emailProvider);
      }
      this.updateHealth(HealthCheckStatus.SERVING);

      const config = ConfigController.getInstance().config as Config;
      if (config.storeEmails.storage.enabled && !this.grpcSdk.isAvailable('storage')) {
        ConduitGrpcSdk.Logger.warn(
          'Failed to enable email storing. Storage module not serving.',
        );
      }
      await this.handleEmailCleanupJob(config);
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

  async sendEmail(
    call: GrpcRequest<SendEmailRequest>,
    callback: GrpcCallback<SendEmailResponse>,
  ) {
    const template = call.request.templateName;
    const emailConfig: Config = await this.grpcSdk.config
      .get('email')
      .catch(() => ConduitGrpcSdk.Logger.error('Failed to get sending domain'));
    const params: ISendEmailParams = {
      email: call.request.params!.email,
      variables: JSON.parse(call.request.params!.variables),
      sender: call.request.params!.sender ?? '',
      cc: call.request.params!.cc,
      replyTo: call.request.params!.replyTo,
      attachments: call.request.params!.attachments,
      sendingDomain: emailConfig?.sendingDomain ?? '',
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

  private async handleEmailCleanupJob(config: Config) {
    this.emailCleanupQueue = new Queue('email-cleanup-queue', {
      connection: this.redisConnection,
    });
    await this.emailCleanupQueue.drain(true);
    if (!config.storeEmails.enabled || !config.storeEmails.cleanupSettings.enabled) {
      await this.emailCleanupQueue.close();
      return;
    }
    const processorFile = path.normalize(
      path.join(__dirname, 'jobs', 'cleanupStoredEmails.js'),
    );
    const worker = new Worker('email-cleanup-queue', processorFile, {
      connection: this.redisConnection,
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 24 * 3600,
      },
    });
    worker.on('active', job => {
      ConduitGrpcSdk.Logger.info(`Stored email cleanup job ${job.id} started`);
    });
    worker.on('completed', () => {
      ConduitGrpcSdk.Logger.info(`Stored email cleanup completed`);
    });
    worker.on('error', (error: Error) => {
      ConduitGrpcSdk.Logger.error(`Stored email cleanup error:`);
      ConduitGrpcSdk.Logger.error(error);
    });

    worker.on('failed', (_job, error) => {
      ConduitGrpcSdk.Logger.error(`Stored email cleanup error:`);
      ConduitGrpcSdk.Logger.error(error);
    });
    await this.emailCleanupQueue.add(
      'cleanup',
      {
        limit: config.storeEmails.cleanupSettings.limit,
        deleteStorageFiles: config.storeEmails.storage.enabled,
      },
      {
        repeat: {
          every: config.storeEmails.cleanupSettings.repeat,
        },
      },
    );
  }
}
