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
import {
  collectLegacyModulesFound,
  getDefaultCommunicationsConfig,
  LEGACY_MODULE_CONFIG_KEYS,
  mergeLegacyChannelConfigs,
  type LegacyModuleConfigs,
} from './config/legacyConfigMigration.js';
import { AdminHandlers } from './admin/index.js';
import { PushNotificationsRoutes } from './routes/push-notifications.routes.js';
import { EmailService } from './services/email.service.js';
import { PushService } from './services/push.service.js';
import { SmsService } from './services/sms.service.js';
import { OrchestratorService } from './services/orchestrator.service.js';
import { CommunicationTemplateService } from './services/communication-template.service.js';
import { QueueController } from './controllers/queue.controller.js';
import * as models from './models/index.js';
import type { CommunicationTemplate } from './models/CommunicationTemplate.schema.js';
import { runMigrations } from './migrations/index.js';
import metricsSchema from './metrics/index.js';
import {
  ConfigController,
  ManagedModule,
  sanitizeDocumentsForExport,
  type ExportableResource,
  type ExportResult,
  type ImportResult,
} from '@conduitplatform/module-tools';

// Provider imports
import { EmailProvider } from './providers/email/index.js';
import { BaseNotificationProvider } from './providers/push/base.provider.js';
import { ISmsProvider } from './providers/sms/interfaces/ISmsProvider.js';

// Import all proto types
import {
  GetEmailStatusRequest,
  GetEmailStatusResponse,
  GetMessageStatusRequest,
  GetMessageStatusResponse,
  GetNotificationTokensRequest,
  GetNotificationTokensResponse,
  RegisterCommunicationTemplateRequest,
  RegisterCommunicationTemplateResponse,
  UpdateCommunicationTemplateRequest,
  DeleteCommunicationTemplateRequest,
  DeleteCommunicationTemplateResponse,
  GetCommunicationTemplateRequest,
  GetCommunicationTemplateResponse,
  ListCommunicationTemplatesRequest,
  ListCommunicationTemplatesResponse,
  RegisterTemplateRequest,
  RegisterTemplateResponse,
  ResendEmailRequest,
  ResendEmailResponse,
  SendCommunicationRequest,
  SendCommunicationResponse,
  SendEmailRequest,
  SendEmailResponse,
  SendManyNotificationsRequest,
  SendNotificationRequest,
  SendNotificationResponse,
  SendNotificationToManyDevicesRequest,
  SendSmsRequest,
  SendSmsResponse,
  SendToMultipleChannelsRequest,
  SendToMultipleChannelsResponse,
  SendVerificationCodeRequest,
  SendVerificationCodeResponse,
  SendWithFallbackRequest,
  SendWithFallbackResponse,
  SetNotificationTokenRequest,
  SetNotificationTokenResponse,
  UpdateTemplateRequest,
  VerifyRequest,
  VerifyResponse,
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
      sendCommunication: this.sendCommunication.bind(this),
      sendToMultipleChannels: this.sendToMultipleChannels.bind(this),
      sendWithFallback: this.sendWithFallback.bind(this),
      registerCommunicationTemplate: this.registerCommunicationTemplate.bind(this),
      updateCommunicationTemplate: this.updateCommunicationTemplate.bind(this),
      deleteCommunicationTemplate: this.deleteCommunicationTemplate.bind(this),
      getCommunicationTemplate: this.getCommunicationTemplate.bind(this),
      listCommunicationTemplates: this.listCommunicationTemplates.bind(this),
      getMessageStatus: this.getMessageStatus.bind(this),
    },
  };
  protected metricsSchema = metricsSchema;
  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;
  private userRouter?: PushNotificationsRoutes;
  private database: DatabaseProvider;
  private emailService: EmailService;
  private pushService: PushService;
  private smsService: SmsService;
  private orchestratorService: OrchestratorService;
  private templateService: CommunicationTemplateService;
  private legacyModulesPendingCleanup: string[] = [];

  // Provider instances
  private emailProvider: EmailProvider;
  private pushProvider: BaseNotificationProvider<unknown> | undefined;
  private smsProvider: ISmsProvider | undefined;

  constructor(peerManifestRoot?: string) {
    super('communications', peerManifestRoot);
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
    await this.awaitPeersFromManifest();
    this.database = this.grpcSdk.database!;
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
  }

  async preConfig(config: Config) {
    const hasLegacyKeys = await Promise.all(
      LEGACY_MODULE_CONFIG_KEYS.map(key =>
        this.grpcSdk.state!.getKey(`moduleConfigs.${key}`),
      ),
    ).then(keys => keys.some(Boolean));

    if (hasLegacyKeys) {
      config = await this.mergeLegacyModuleConfigs(config);
    }
    if (isNil(config.email) || isNil(config.pushNotifications) || isNil(config.sms)) {
      throw new Error('Invalid configuration given');
    }
    return config;
  }

  private async mergeLegacyModuleConfigs(config: Config): Promise<Config> {
    const legacyConfigs: LegacyModuleConfigs = {};

    for (const key of LEGACY_MODULE_CONFIG_KEYS) {
      const stateKey = await this.grpcSdk.state!.getKey(`moduleConfigs.${key}`);
      if (!stateKey) continue;

      const moduleConfig = await this.grpcSdk.config.get(key);
      if (moduleConfig && Object.keys(moduleConfig).length > 0) {
        legacyConfigs[key] = moduleConfig;
      }
    }

    const legacyModulesFound = collectLegacyModulesFound(legacyConfigs);
    if (legacyModulesFound.length > 0) {
      this.legacyModulesPendingCleanup = legacyModulesFound;
    }

    const { config: mergedConfig, migratedChannels } = mergeLegacyChannelConfigs(
      config,
      legacyConfigs,
      getDefaultCommunicationsConfig(),
    );

    if (migratedChannels.length > 0) {
      ConduitGrpcSdk.Logger.log(
        `Migrated legacy configuration for channels: ${migratedChannels.join(', ')}`,
      );
    }

    return mergedConfig;
  }

  async onConfig() {
    const config = ConfigController.getInstance().config as Config;

    if (this.legacyModulesPendingCleanup.length > 0) {
      const modulesToRemove = [...this.legacyModulesPendingCleanup];
      for (const name of modulesToRemove) {
        await this.grpcSdk.config.delete(name);
      }
      ConduitGrpcSdk.Logger.log(
        `Removed legacy module configuration: ${modulesToRemove.join(', ')}`,
      );
      this.legacyModulesPendingCleanup = [];
    }

    if (!this.isRunning) {
      await this.initServices();
      this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk);
      this.adminRouter.setServices(
        this.emailService,
        this.pushService,
        this.smsService,
        this.orchestratorService,
        this.templateService,
      );

      // Initialize user routes for push notifications
      if (this.grpcSdk.isAvailable('router')) {
        this.userRouter = new PushNotificationsRoutes(
          this.grpcServer,
          this.grpcSdk,
          this.pushService,
        );
      }

      // Initialize queue controller and workers
      const queueController = QueueController.getInstance(this.grpcSdk);
      queueController.addEmailStatusWorker();
      queueController.addEmailCleanupWorker();
      this.isRunning = true;
    }

    await this.emailService.initEmailProvider(config);
    await this.pushService.initPushProvider(config);
    await this.smsService.initSmsProvider(config);

    this.updateHealth(HealthCheckStatus.SERVING);
  }

  async initializeMetrics() {
    const [emailTemplatesTotal, communicationTemplatesTotal] = await Promise.all([
      models.EmailTemplate.getInstance().countDocuments({}),
      models.CommunicationTemplate.getInstance().countDocuments({}),
    ]);
    ConduitGrpcSdk.Metrics?.set('email_templates_total', emailTemplatesTotal);
    ConduitGrpcSdk.Metrics?.set(
      'communication_templates_total',
      communicationTemplatesTotal,
    );
  }

  // Framework export/import (GitOps)
  protected getExportableResources(): ExportableResource[] {
    return [
      { type: 'emailTemplates', description: 'Email templates', priority: 30 },
      {
        type: 'communicationTemplates',
        description: 'Unified communication templates',
        priority: 30,
      },
    ];
  }

  protected async exportResources(resourceTypes?: string[]): Promise<ExportResult> {
    if (!this.database) return {};
    const out: ExportResult = {};
    const wantAll = !resourceTypes || resourceTypes.length === 0;
    if (wantAll || resourceTypes!.includes('emailTemplates')) {
      const email = await models.EmailTemplate.getInstance(this.database).findMany({});
      out.emailTemplates = sanitizeDocumentsForExport(
        email as unknown as Record<string, unknown>[],
      );
    }
    if (wantAll || resourceTypes!.includes('communicationTemplates')) {
      const comm = await models.CommunicationTemplate.getInstance(this.database).findMany(
        {},
      );
      out.communicationTemplates = sanitizeDocumentsForExport(
        comm as unknown as Record<string, unknown>[],
      );
    }
    return out;
  }

  protected async importResources(data: ExportResult): Promise<ImportResult> {
    if (!this.database) return {};
    const result: ImportResult = {
      emailTemplates: { created: 0, updated: 0, failed: 0, errors: [] },
      communicationTemplates: { created: 0, updated: 0, failed: 0, errors: [] },
    };
    const emailModel = models.EmailTemplate.getInstance(this.database);
    const commModel = models.CommunicationTemplate.getInstance(this.database);

    for (const rec of data.emailTemplates ?? []) {
      const r = rec as Record<string, unknown>;
      const name = r.name;
      if (name == null || name === '') {
        result.emailTemplates.failed += 1;
        result.emailTemplates.errors.push('Missing name');
        continue;
      }
      try {
        const existing = await emailModel.findOne({ name });
        if (existing) {
          await emailModel.updateOne({ name }, r);
          result.emailTemplates.updated += 1;
        } else {
          await emailModel.create(r);
          result.emailTemplates.created += 1;
        }
      } catch (e) {
        result.emailTemplates.failed += 1;
        result.emailTemplates.errors.push(`${String(name)}: ${(e as Error).message}`);
      }
    }
    for (const rec of data.communicationTemplates ?? []) {
      const r = rec as Record<string, unknown>;
      const name = r.name;
      if (name == null || name === '') {
        result.communicationTemplates.failed += 1;
        result.communicationTemplates.errors.push('Missing name');
        continue;
      }
      try {
        const emailCollision = await emailModel.findOne({ name });
        if (emailCollision) {
          result.communicationTemplates.failed += 1;
          result.communicationTemplates.errors.push(
            `${String(name)}: name conflicts with existing email template`,
          );
          continue;
        }

        this.templateService.validateForImport(r);

        const existing = await commModel.findOne({ name });
        if (existing) {
          await commModel.updateOne({ name }, r);
          result.communicationTemplates.updated += 1;
        } else {
          await commModel.create(r);
          result.communicationTemplates.created += 1;
        }
      } catch (e) {
        result.communicationTemplates.failed += 1;
        result.communicationTemplates.errors.push(
          `${String(name)}: ${(e as Error).message}`,
        );
      }
    }

    const commTemplateCount = await commModel.countDocuments({});
    ConduitGrpcSdk.Metrics?.set('communication_templates_total', commTemplateCount);

    return result;
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
      attachments: call.request.params!.attachments.map(attachment => ({
        ...attachment,
        content: attachment.content ? Buffer.from(attachment.content) : undefined,
        httpHeaders: attachment.httpHeaders
          ? JSON.parse(attachment.httpHeaders)
          : undefined,
      })),
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
      ConduitGrpcSdk.Metrics?.increment('push_notifications_sent_total', 1);
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    return callback(null, { message: 'Ok' });
  }

  async sendNotificationToManyDevices(
    call: GrpcRequest<SendNotificationToManyDevicesRequest>,
    callback: GrpcCallback<SendNotificationResponse>,
  ) {
    if (call.request.sendTo.length === 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'sendTo is required and must be a non-empty array',
      });
    }
    try {
      const result = await this.pushService.sendToManyDevices({
        sendTo: call.request.sendTo,
        title: call.request.title,
        body: call.request.body,
        data: call.request.data ? JSON.parse(call.request.data) : {},
        platform: call.request.platform,
        doNotStore: call.request.doNotStore,
        isSilent: call.request.isSilent,
      });
      ConduitGrpcSdk.Metrics?.increment(
        'push_notifications_sent_total',
        result.successCount,
      );
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
    return callback(null, { message: 'Ok' });
  }

  async sendManyNotifications(
    call: GrpcRequest<SendManyNotificationsRequest>,
    callback: GrpcCallback<SendNotificationResponse>,
  ) {
    if (call.request.notifications.length === 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'notifications is required and must be a non-empty array',
      });
    }
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
      const result = await this.pushService.sendManyNotifications(notifications);
      ConduitGrpcSdk.Metrics?.increment(
        'push_notifications_sent_total',
        result.successCount,
      );
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
  async sendCommunication(
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
      templateName: templateName || undefined,
    };

    let errorMessage: string | null = null;
    const result = await this.orchestratorService
      .sendToChannel(channel as 'email' | 'push' | 'sms', sendParams)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (typeof result === 'string') {
      return callback({ code: status.INTERNAL, message: result });
    }

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
      templateName: templateName || undefined,
    };

    let errorMessage: string | null = null;
    const result = await this.orchestratorService
      .sendToMultipleChannels(sendParams)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (typeof result === 'string') {
      return callback({ code: status.INTERNAL, message: result });
    }

    return callback(null, {
      results: result.results.map(r => ({
        success: r.success,
        messageId: r.messageId || '',
        error: r.error,
        channel: r.channel,
      })),
    });
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
      templateName: templateName || undefined,
    };

    let errorMessage: string | null = null;
    const result = await this.orchestratorService
      .sendWithFallback(sendParams)
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (typeof result === 'string') {
      return callback({ code: status.INTERNAL, message: result });
    }

    return callback(null, {
      successfulChannel: result.successfulChannel,
      messageId: result.messageId || '',
      attempts: result.attempts.map(a => ({
        success: a.success,
        messageId: a.messageId || '',
        error: a.error,
        channel: a.channel,
      })),
    });
  }

  async registerCommunicationTemplate(
    call: GrpcRequest<RegisterCommunicationTemplateRequest>,
    callback: GrpcCallback<RegisterCommunicationTemplateResponse>,
  ) {
    try {
      const template = await this.templateService.create(
        this.mapProtoToCreateParams(call.request),
      );
      return callback(null, { template: JSON.stringify(template) });
    } catch (e) {
      const message = (e as Error).message;
      const code = message.includes('already exists')
        ? status.ALREADY_EXISTS
        : status.INTERNAL;
      return callback({ code, message });
    }
  }

  async updateCommunicationTemplate(
    call: GrpcRequest<UpdateCommunicationTemplateRequest>,
    callback: GrpcCallback<RegisterCommunicationTemplateResponse>,
  ) {
    try {
      const template = await this.templateService.update(
        call.request.id,
        this.mapProtoToUpdateParams(call.request),
      );
      return callback(null, { template: JSON.stringify(template) });
    } catch (e) {
      const message = (e as Error).message;
      const code = message.includes('not found')
        ? status.NOT_FOUND
        : message.includes('already exists')
          ? status.ALREADY_EXISTS
          : status.INTERNAL;
      return callback({ code, message });
    }
  }

  async deleteCommunicationTemplate(
    call: GrpcRequest<DeleteCommunicationTemplateRequest>,
    callback: GrpcCallback<DeleteCommunicationTemplateResponse>,
  ) {
    try {
      const result = await this.templateService.delete(call.request.id);
      return callback(null, { deleted: result.deleted });
    } catch (e) {
      const message = (e as Error).message;
      const code = message.includes('not found') ? status.NOT_FOUND : status.INTERNAL;
      return callback({ code, message });
    }
  }

  async getCommunicationTemplate(
    call: GrpcRequest<GetCommunicationTemplateRequest>,
    callback: GrpcCallback<GetCommunicationTemplateResponse>,
  ) {
    try {
      let template;
      if (call.request.id) {
        template = await this.templateService.getById(call.request.id);
      } else if (call.request.name) {
        template = await this.templateService.getByName(call.request.name);
        if (!template) {
          return callback({ code: status.NOT_FOUND, message: 'Template does not exist' });
        }
      } else {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'Either id or name must be provided',
        });
      }
      return callback(null, { template: JSON.stringify(template) });
    } catch (e) {
      const message = (e as Error).message;
      const code = message.includes('not found') ? status.NOT_FOUND : status.INTERNAL;
      return callback({ code, message });
    }
  }

  async listCommunicationTemplates(
    call: GrpcRequest<ListCommunicationTemplatesRequest>,
    callback: GrpcCallback<ListCommunicationTemplatesResponse>,
  ) {
    const { skip, limit, search } = call.request;
    let query: Record<string, unknown> = {};
    if (search) {
      if (search.match(/^[a-fA-F\d]{24}$/)) {
        query = { _id: search };
      } else {
        query = { name: { $regex: `.*${search}.*`, $options: 'i' } };
      }
    }

    try {
      const { documents, count } = await this.templateService.list(query as never, {
        skip,
        limit,
      });
      return callback(null, {
        templates: documents.map((doc: CommunicationTemplate) => JSON.stringify(doc)),
        count,
      });
    } catch (e) {
      return callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }

  private mapProtoToCreateParams(request: RegisterCommunicationTemplateRequest) {
    const nested = request.template;
    return {
      name: request.name,
      channels: (request.channels ?? []) as ('email' | 'push' | 'sms')[],
      summary: request.description,
      variables: request.variables?.length ? request.variables : undefined,
      email: nested?.email
        ? {
            subject: nested.email.subject,
            body: nested.email.body,
            sender: nested.email.sender,
          }
        : undefined,
      push: nested?.push
        ? {
            title: nested.push.title,
            body: nested.push.body,
          }
        : undefined,
      sms: nested?.sms
        ? {
            message: nested.sms.message,
          }
        : undefined,
    };
  }

  private mapProtoToUpdateParams(request: UpdateCommunicationTemplateRequest) {
    const nested = request.template;
    return {
      name: request.name,
      channels: request.channels?.length
        ? (request.channels as ('email' | 'push' | 'sms')[])
        : undefined,
      summary: request.description,
      variables: request.variables?.length ? request.variables : undefined,
      email: nested?.email
        ? {
            subject: nested.email.subject,
            body: nested.email.body,
            sender: nested.email.sender,
          }
        : undefined,
      push: nested?.push
        ? {
            title: nested.push.title,
            body: nested.push.body,
          }
        : undefined,
      sms: nested?.sms
        ? {
            message: nested.sms.message,
          }
        : undefined,
    };
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
      if (Object.keys(modelInstance.fields).length !== 0) {
        await this.database.createSchemaFromAdapter(modelInstance);
        return await this.database.migrate(modelInstance.name);
      }
    });
    return Promise.all(promises);
  }

  private async initServices() {
    this.emailService = new EmailService(this.grpcSdk);
    this.pushService = new PushService(this.grpcSdk);
    this.smsService = new SmsService(this.grpcSdk);
    this.templateService = new CommunicationTemplateService(this.grpcSdk);

    this.orchestratorService = new OrchestratorService(
      this.grpcSdk,
      this.emailService,
      this.pushService,
      this.smsService,
      this.templateService,
    );
  }
}
