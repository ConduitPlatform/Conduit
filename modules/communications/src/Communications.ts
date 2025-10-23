import {
  ConduitGrpcSdk,
  DatabaseProvider,
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import path from 'path';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { fileURLToPath } from 'node:url';

import AppConfigSchema, { Config } from './config/index.js';
import { AdminHandlers } from './admin/index.js';
import { EmailService } from './services/email.service.js';
import { PushService } from './services/push.service.js';
import { SmsService } from './services/sms.service.js';
import { OrchestratorService } from './services/orchestrator.service.js';
import { QueueController } from './controllers/queue.controller.js';
import * as models from './models/index.js';
import { runMigrations } from './migrations/index.js';
import metricsSchema from './metrics/index.js';
import { ConfigController, ManagedModule } from '@conduitplatform/module-tools';

// Import all proto types
import {
  // Legacy Email
  RegisterTemplateRequest,
  RegisterTemplateResponse,
  UpdateTemplateRequest,
  SendEmailRequest,
  SendEmailResponse,
  ResendEmailRequest,
  ResendEmailResponse,
  GetEmailStatusRequest,
  GetEmailStatusResponse,
  // Legacy Push
  SetNotificationTokenRequest,
  SetNotificationTokenResponse,
  GetNotificationTokensRequest,
  GetNotificationTokensResponse,
  SendNotificationRequest,
  SendNotificationResponse,
  SendNotificationToManyDevicesRequest,
  SendManyNotificationsRequest,
  // Legacy SMS
  SendSmsRequest,
  SendSmsResponse,
  SendVerificationCodeRequest,
  SendVerificationCodeResponse,
  VerifyRequest,
  VerifyResponse,
  // New unified
  SendCommunicationRequest,
  SendCommunicationResponse,
  SendToMultipleChannelsRequest,
  SendToMultipleChannelsResponse,
  SendWithFallbackRequest,
  SendWithFallbackResponse,
  RegisterCommunicationTemplateRequest,
  RegisterCommunicationTemplateResponse,
  GetMessageStatusRequest,
  GetMessageStatusResponse,
} from './protoTypes/communications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Communications extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'communications.proto'),
    protoDescription: 'communications.Communications',
    functions: {
      // Legacy Email endpoints
      registerTemplate: this.registerTemplate.bind(this),
      updateTemplate: this.updateTemplate.bind(this),
      sendEmail: this.sendEmail.bind(this),
      resendEmail: this.resendEmail.bind(this),
      getEmailStatus: this.getEmailStatus.bind(this),
      // Legacy Push endpoints
      setNotificationToken: this.setNotificationToken.bind(this),
      getNotificationTokens: this.getNotificationTokens.bind(this),
      sendNotification: this.sendNotification.bind(this),
      sendNotificationToManyDevices: this.sendNotificationToManyDevices.bind(this),
      sendManyNotifications: this.sendManyNotifications.bind(this),
      // Legacy SMS endpoints
      sendSms: this.sendSms.bind(this),
      sendVerificationCode: this.sendVerificationCode.bind(this),
      verify: this.verify.bind(this),
      // New unified endpoints
      sendMessage: this.sendMessage.bind(this),
      sendToMultipleChannels: this.sendToMultipleChannels.bind(this),
      sendWithFallback: this.sendWithFallback.bind(this),
      registerCommunicationTemplate: this.registerCommunicationTemplate.bind(this),
      getMessageStatus: this.getMessageStatus.bind(this),
    },
  };
  protected metricsSchema = metricsSchema;
  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;
  private database: DatabaseProvider;
  private emailService: EmailService;
  private pushService: PushService;
  private smsService: SmsService;
  private orchestratorService: OrchestratorService;

  constructor() {
    super('communications');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
  }

  async preConfig(config: Config) {
    if (
      isNil(config.active) ||
      isNil(config.email) ||
      isNil(config.pushNotifications) ||
      isNil(config.sms)
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

      if (!this.isRunning) {
        await this.initServices();
        this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
        this.adminRouter.setServices(
          this.emailService,
          this.pushService,
          this.smsService,
        );

        // Initialize queue controller and workers
        const queueController = QueueController.getInstance(this.grpcSdk);
        queueController.addEmailStatusWorker();
        queueController.addEmailCleanupWorker();

        this.isRunning = true;
      } else {
        await this.initServices();
        this.adminRouter.updateServices(
          this.emailService,
          this.pushService,
          this.smsService,
        );
      }
      this.updateHealth(HealthCheckStatus.SERVING);
    }
  }

  async initializeMetrics() {
    const templatesTotal = await models.EmailTemplate.getInstance().countDocuments({});
    ConduitGrpcSdk.Metrics?.set('email_templates_total', templatesTotal);
  }

  // Legacy Email Service Methods
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
      jsonTemplate: call.request.jsonTemplate,
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
    let variables;
    try {
      variables = JSON.parse(call.request.params!.variables!);
    } catch {
      variables = undefined;
    }
    const params = {
      email: call.request.params!.email,
      body: call.request.params!.body,
      subject: call.request.params!.subject,
      variables: variables,
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

  // Legacy Push Notifications Service Methods
  async setNotificationToken(
    call: GrpcRequest<SetNotificationTokenRequest>,
    callback: GrpcCallback<SetNotificationTokenResponse>,
  ) {
    const { token, platform, userId } = call.request;
    let errorMessage: string | null = null;
    const newTokenDocument = await this.pushService
      .setNotificationToken(token, platform, userId)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, { newTokenDocument: JSON.stringify(newTokenDocument) });
  }

  async getNotificationTokens(
    call: GrpcRequest<GetNotificationTokensRequest>,
    callback: GrpcCallback<GetNotificationTokensResponse>,
  ) {
    const userId = call.request.userId;
    let errorMessage: string | null = null;
    const tokenDocuments = await this.pushService
      .getNotificationTokens(userId)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    const tokenDocs: string[] = [];
    for (const tokenDocument of tokenDocuments || []) {
      const tokenDocumentString = JSON.stringify(tokenDocument);
      tokenDocs.push(tokenDocumentString);
    }
    return callback(null, { tokenDocuments: tokenDocs });
  }

  async sendNotification(
    call: GrpcRequest<SendNotificationRequest>,
    callback: GrpcCallback<SendNotificationResponse>,
  ) {
    try {
      await this.pushService.sendNotification({
        sendTo: call.request.sendTo,
        title: call.request.title,
        body: call.request.body,
        data: call.request.data ? JSON.parse(call.request.data) : {},
        platform: call.request.platform,
        doNotStore: call.request.doNotStore,
        isSilent: call.request.isSilent,
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    return callback(null, { message: 'Ok' });
  }

  async sendNotificationToManyDevices(
    call: GrpcRequest<SendNotificationToManyDevicesRequest>,
    callback: GrpcCallback<SendNotificationResponse>,
  ) {
    try {
      await this.pushService.sendToManyDevices({
        sendTo: call.request.sendTo,
        title: call.request.title,
        body: call.request.body,
        data: call.request.data ? JSON.parse(call.request.data) : {},
        platform: call.request.platform,
        doNotStore: call.request.doNotStore,
        isSilent: call.request.isSilent,
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    return callback(null, { message: 'Ok' });
  }

  async sendManyNotifications(
    call: GrpcRequest<SendManyNotificationsRequest>,
    callback: GrpcCallback<SendNotificationResponse>,
  ) {
    try {
      const notifications = call.request.notifications.map(notification => ({
        sendTo: notification.sendTo,
        title: notification.title,
        body: notification.body,
        data: notification.data ? JSON.parse(notification.data) : {},
        platform: notification.platform,
        doNotStore: notification.doNotStore,
        isSilent: notification.isSilent,
      }));
      await this.pushService.sendManyNotifications(notifications);
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    return callback(null, { message: 'Ok' });
  }

  // Legacy SMS Service Methods
  async sendSms(
    call: GrpcRequest<SendSmsRequest>,
    callback: GrpcCallback<SendSmsResponse>,
  ) {
    const to = call.request.to;
    const message = call.request.message;
    if (isNil(this.smsService)) {
      return callback({ code: status.INTERNAL, message: 'No SMS service' });
    }

    let errorMessage: string | null = null;
    await this.smsService.sendSms(to, message).catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { message: 'SMS sent' });
  }

  async sendVerificationCode(
    call: GrpcRequest<SendVerificationCodeRequest>,
    callback: GrpcCallback<SendVerificationCodeResponse>,
  ) {
    const to = call.request.to;
    if (isNil(this.smsService)) {
      return callback({ code: status.INTERNAL, message: 'No SMS service' });
    }
    if (isNil(to)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'No SMS recipient',
      });
    }

    let errorMessage: string | null = null;
    const verificationSid = await this.smsService
      .sendVerificationCode(to)
      .catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { verificationSid });
  }

  async verify(call: GrpcRequest<VerifyRequest>, callback: GrpcCallback<VerifyResponse>) {
    const { verificationSid, code } = call.request;
    if (isNil(this.smsService)) {
      return callback({ code: status.INTERNAL, message: 'No SMS service' });
    }
    if (isNil(verificationSid) || isNil(code)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'No verification id or code provided',
      });
    }

    let errorMessage: string | null = null;
    const verified = await this.smsService
      .verify(verificationSid, code)
      .catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { verified });
  }

  // New Unified Service Methods
  async sendMessage(
    call: GrpcRequest<SendCommunicationRequest>,
    callback: GrpcCallback<SendCommunicationResponse>,
  ) {
    const { channel, templateName, params } = call.request;
    let variables;
    try {
      variables = JSON.parse(params!.variables!);
    } catch {
      variables = undefined;
    }

    const sendParams = {
      recipient: params!.recipient,
      subject: params!.subject,
      body: params!.body,
      variables: variables,
      sender: params!.sender,
      cc: params!.cc,
      replyTo: params!.replyTo,
      attachments: params!.attachments,
      data: params!.data ? JSON.parse(params!.data) : undefined,
      platform: params!.platform,
      doNotStore: params!.doNotStore,
      isSilent: params!.isSilent,
    };

    let errorMessage: string | null = null;
    const result = await this.orchestratorService
      .sendToChannel(channel as 'email' | 'push' | 'sms', sendParams)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, {
      messageId: result.messageId || '',
      sentMessageInfo: JSON.stringify(result),
    });
  }

  async sendToMultipleChannels(
    call: GrpcRequest<SendToMultipleChannelsRequest>,
    callback: GrpcCallback<SendToMultipleChannelsResponse>,
  ) {
    const { channels, strategy, templateName, params } = call.request;
    let variables;
    try {
      variables = JSON.parse(params!.variables!);
    } catch {
      variables = undefined;
    }

    const sendParams = {
      channels: channels as ('email' | 'push' | 'sms')[],
      strategy: strategy as 'BEST_EFFORT' | 'ALL_OR_NOTHING',
      recipient: params!.recipient,
      subject: params!.subject,
      body: params!.body,
      variables: variables,
      sender: params!.sender,
      cc: params!.cc,
      replyTo: params!.replyTo,
      attachments: params!.attachments,
      data: params!.data ? JSON.parse(params!.data) : undefined,
      platform: params!.platform,
      doNotStore: params!.doNotStore,
      isSilent: params!.isSilent,
    };

    let errorMessage: string | null = null;
    const result = await this.orchestratorService
      .sendToMultipleChannels(sendParams)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, { results: result.results });
  }

  async sendWithFallback(
    call: GrpcRequest<SendWithFallbackRequest>,
    callback: GrpcCallback<SendWithFallbackResponse>,
  ) {
    const { fallbackChain, templateName, params } = call.request;
    let variables;
    try {
      variables = JSON.parse(params!.variables!);
    } catch {
      variables = undefined;
    }

    const sendParams = {
      fallbackChain: fallbackChain.map(step => ({
        channel: step.channel as 'email' | 'push' | 'sms',
        timeout: step.timeout,
      })),
      recipient: params!.recipient,
      subject: params!.subject,
      body: params!.body,
      variables: variables,
      sender: params!.sender,
      cc: params!.cc,
      replyTo: params!.replyTo,
      attachments: params!.attachments,
      data: params!.data ? JSON.parse(params!.data) : undefined,
      platform: params!.platform,
      doNotStore: params!.doNotStore,
      isSilent: params!.isSilent,
    };

    let errorMessage: string | null = null;
    const result = await this.orchestratorService
      .sendWithFallback(sendParams)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, {
      successfulChannel: result.successfulChannel,
      messageId: result.messageId || '',
      attempts: result.attempts,
    });
  }

  async registerCommunicationTemplate(
    call: GrpcRequest<RegisterCommunicationTemplateRequest>,
    callback: GrpcCallback<RegisterCommunicationTemplateResponse>,
  ) {
    // This would implement the unified template registration
    // For now, return a placeholder
    return callback(null, { template: JSON.stringify({ name: call.request.name }) });
  }

  async getMessageStatus(
    call: GrpcRequest<GetMessageStatusRequest>,
    callback: GrpcCallback<GetMessageStatusResponse>,
  ) {
    const { messageId, channel } = call.request;
    let errorMessage: string | null = null;
    const statusInfo = await this.orchestratorService
      .getChannelStatus(channel as 'email' | 'push' | 'sms', messageId)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });
    return callback(null, { statusInfo: JSON.stringify(statusInfo) });
  }

  protected registerSchemas(): Promise<unknown> {
    const promises = Object.values(models).map(async model => {
      const modelInstance = model.getInstance(this.database);
      await this.database.createSchemaFromAdapter(modelInstance);
      return await this.database.migrate(modelInstance.name);
    });
    return Promise.all(promises);
  }

  private async initServices() {
    // Initialize email service
    // Initialize push service
    // Initialize SMS service
    // Initialize orchestrator service

    // For now, create placeholder services
    this.emailService = new EmailService(this.grpcSdk, null as any);
    this.pushService = new PushService(this.grpcSdk, null as any);
    this.smsService = new SmsService(this.grpcSdk, null as any);
    this.orchestratorService = new OrchestratorService(
      this.grpcSdk,
      this.emailService,
      this.pushService,
      this.smsService,
    );
  }
}
