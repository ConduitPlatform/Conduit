import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  Query,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitDate,
  ConduitJson,
  ConduitNumber,
  ConduitObjectId,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { to } from 'await-to-js';
import { isNil } from 'lodash-es';
import escapeStringRegexp from 'escape-string-regexp';
import { EmailService } from '../services/email.service.js';
import { PushService } from '../services/push.service.js';
import { SmsService } from '../services/sms.service.js';
import { OrchestratorService } from '../services/orchestrator.service.js';
import { CommunicationTemplateService } from '../services/communication-template.service.js';
import {
  EmailTemplate,
  EmailRecord,
  NotificationToken,
  SmsRecord,
  CommunicationTemplate,
} from '../models/index.js';
import { getHandleBarsValues } from '../providers/email/utils/index.js';
import { Template } from '../providers/email/interfaces/Template.js';
import { TemplateDocument } from '../providers/email/interfaces/TemplateDocument.js';

export class AdminHandlers {
  private emailService: EmailService;
  private pushService: PushService;
  private smsService: SmsService;
  private orchestratorService: OrchestratorService;
  private templateService: CommunicationTemplateService;
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  setServices(
    emailService: EmailService,
    pushService: PushService,
    smsService: SmsService,
    orchestratorService: OrchestratorService,
    templateService: CommunicationTemplateService,
  ) {
    this.emailService = emailService;
    this.pushService = pushService;
    this.smsService = smsService;
    this.orchestratorService = orchestratorService;
    this.templateService = templateService;
  }

  // Email admin routes
  async sendEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { templateName, body, subject, email, variables } = call.request.params;
    let { sender } = call.request.params;
    if (!templateName && (!body || !subject)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Template/body+subject not provided');
    }
    sender ??= 'conduit';

    if (sender.indexOf('@') === -1) {
      const emailConfig = await this.grpcSdk.config
        .get('communications')
        .catch(() => ConduitGrpcSdk.Logger.error('Failed to get sending domain'));
      sender = sender + `@${emailConfig?.email?.sendingDomain ?? 'conduit.com'}`;
    }

    const sentEmailInfo = await this.emailService
      .sendEmail(templateName, {
        body,
        subject,
        email,
        variables,
        sender: sender,
      })
      .catch((e: Error) => {
        ConduitGrpcSdk.Logger.error(e);
        throw new GrpcError(status.INTERNAL, e.message);
      });
    ConduitGrpcSdk.Metrics?.increment('emails_sent_total');
    return { message: sentEmailInfo.messageId ?? 'Email sent' };
  }

  // Push notification admin routes
  async sendNotification(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = {
      sendTo: call.request.params.userId,
      title: call.request.params.title,
      body: call.request.params.body,
      data: call.request.params.data,
      isSilent: call.request.params.isSilent,
      platform: call.request.params.platform,
      doNotStore: call.request.params.doNotStore,
    };
    await this.pushService.sendNotification(params).catch(e => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    ConduitGrpcSdk.Metrics?.increment('push_notifications_sent_total', 1);
    return 'Ok';
  }

  // SMS admin routes
  async sendSms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { to, message } = call.request.params;
    await this.smsService.sendSms(to, message).catch(e => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    ConduitGrpcSdk.Metrics?.increment('sms_sent_total');
    return 'SMS sent';
  }

  // Unified communication routes
  async sendToMultipleChannels(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { channels, strategy, recipient, subject, body, variables, templateName } =
      call.request.params;

    const sendParams = {
      channels: channels as ('email' | 'push' | 'sms')[],
      strategy: strategy as 'BEST_EFFORT' | 'ALL_OR_NOTHING',
      recipient,
      subject,
      body,
      variables,
      templateName,
    };

    const result = await this.orchestratorService
      .sendToMultipleChannels(sendParams)
      .catch(e => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return {
      successCount: result.successCount,
      failureCount: result.failureCount,
      results: result.results,
    };
  }

  async sendWithFallback(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { fallbackChain, recipient, subject, body, variables, templateName } =
      call.request.params;

    const sendParams = {
      fallbackChain: fallbackChain.map((step: { channel: string; timeout?: number }) => ({
        channel: step.channel as 'email' | 'push' | 'sms',
        timeout: step.timeout,
      })),
      recipient,
      subject,
      body,
      variables,
      templateName,
    };

    const result = await this.orchestratorService
      .sendWithFallback(sendParams)
      .catch(e => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return {
      successfulChannel: result.successfulChannel,
      messageId: result.messageId,
      attempts: result.attempts,
    };
  }

  // Unified communication template management
  async sendCommunication(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { channel, templateName, recipient, subject, body, variables, sender } =
      call.request.params;

    const result = await this.orchestratorService
      .sendToChannel(channel as 'email' | 'push' | 'sms', {
        recipient,
        subject,
        body,
        variables,
        sender,
        templateName,
      })
      .catch(e => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return result;
  }

  async getCommunicationTemplates(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query<CommunicationTemplate> = {};
    let identifier;
    if (!isNil(call.request.params.search)) {
      if (call.request.params.search.match(/^[a-fA-F\d]{24}$/)) {
        query = { _id: call.request.params.search };
      } else {
        identifier = escapeStringRegexp(call.request.params.search);
        query = { name: { $regex: `.*${identifier}.*`, $options: 'i' } };
      }
    }

    const { documents, count } = await this.templateService
      .list(query, { skip, limit, sort })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return { templateDocuments: documents, count };
  }

  async getCommunicationTemplate(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const template = await this.templateService
      .getById(call.request.urlParams.id)
      .catch((e: Error) => {
        if (e.message.includes('not exist')) {
          throw new GrpcError(status.NOT_FOUND, e.message);
        }
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return { template };
  }

  async createCommunicationTemplate(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { name, channels, email, push, sms, variables, templateDescription } =
      call.request.params;
    const template = await this.templateService
      .create({
        name,
        channels,
        email,
        push,
        sms,
        variables,
        summary: templateDescription,
      })
      .catch((e: Error) => {
        if (e.message.includes('already exists')) {
          throw new GrpcError(status.ALREADY_EXISTS, e.message);
        }
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return { template };
  }

  async patchCommunicationTemplate(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const bodyParams = { ...call.request.bodyParams };
    if (bodyParams.templateDescription !== undefined) {
      bodyParams.summary = bodyParams.templateDescription;
      delete bodyParams.templateDescription;
    }
    const template = await this.templateService
      .update(call.request.urlParams.id, bodyParams)
      .catch((e: Error) => {
        if (e.message.includes('not exist')) {
          throw new GrpcError(status.NOT_FOUND, e.message);
        }
        if (e.message.includes('already exists')) {
          throw new GrpcError(status.ALREADY_EXISTS, e.message);
        }
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return { template };
  }

  async deleteCommunicationTemplate(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    return await this.templateService
      .delete(call.request.urlParams.id)
      .catch((e: Error) => {
        if (e.message.includes('not exist')) {
          throw new GrpcError(status.NOT_FOUND, e.message);
        }
        throw new GrpcError(status.INTERNAL, e.message);
      });
  }

  async migrateFromEmailTemplate(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { emailTemplateId, dryRun, skipExisting, deleteSource } = call.request.params;
    return await this.templateService
      .migrateFromEmailTemplate({
        emailTemplateId,
        dryRun,
        skipExisting,
        deleteSource,
      })
      .catch((e: Error) => {
        if (e.message.includes('already exists')) {
          throw new GrpcError(status.ALREADY_EXISTS, e.message);
        }
        throw new GrpcError(status.INTERNAL, e.message);
      });
  }

  // Email template management methods
  async getTemplates(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query<EmailTemplate> = {};
    let identifier;
    if (!isNil(call.request.params.search)) {
      if (call.request.params.search.match(/^[a-fA-F\d]{24}$/)) {
        query = { _id: call.request.params.search };
      } else {
        identifier = escapeStringRegexp(call.request.params.search);
        query = { name: { $regex: `.*${identifier}.*`, $options: 'i' } };
      }
    }

    const templateDocumentsPromise = EmailTemplate.getInstance().findMany(query, {
      skip,
      limit,
      sort,
    });
    const totalCountPromise = EmailTemplate.getInstance().countDocuments(query);
    const [templateDocuments, count] = await Promise.all([
      templateDocumentsPromise,
      totalCountPromise,
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

    return { templateDocuments, count };
  }

  async createTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { _id, sender, externalManaged, name, subject, body, jsonTemplate } =
      call.request.params;

    let externalId = undefined;
    const body_vars = getHandleBarsValues(body);
    const subject_vars = getHandleBarsValues(subject);

    let variables = Object.keys(body_vars).concat(Object.keys(subject_vars));
    variables = variables.filter((value, index) => variables.indexOf(value) === index);

    if (externalManaged) {
      if (isNil(_id)) {
        const [err, template] = await to(
          this.emailService.createExternalTemplate({
            name,
            body,
            subject,
          }),
        );
        if (err) {
          throw new GrpcError(status.INTERNAL, err.message);
        }
        externalId = (template as Template)?.id;
      } else {
        externalId = _id;
      }
    }

    const unifiedCollision = await CommunicationTemplate.getInstance().findOne({ name });
    if (!isNil(unifiedCollision)) {
      throw new GrpcError(
        status.ALREADY_EXISTS,
        `A unified template named '${name}' already exists`,
      );
    }

    const newTemplate = await EmailTemplate.getInstance()
      .create({
        name,
        subject,
        body,
        variables,
        externalManaged,
        sender,
        externalId,
        jsonTemplate,
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    ConduitGrpcSdk.Metrics?.increment('email_templates_total');
    return { template: newTemplate };
  }

  async patchTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return await this.emailService.updateTemplate(
      call.request.urlParams.id,
      call.request.bodyParams,
    );
  }

  async deleteTemplate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const templateDocument = await EmailTemplate.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(templateDocument)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
    }

    await EmailTemplate.getInstance()
      .deleteOne({ _id: call.request.params.id })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    let deleted;
    if (templateDocument!.externalManaged) {
      deleted = await this.emailService
        .deleteExternalTemplate(templateDocument!.externalId!)
        ?.catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
    }
    ConduitGrpcSdk.Metrics?.decrement('email_templates_total');
    return { deleted };
  }

  async getExternalTemplates(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const {
      skip = 0,
      limit = 25,
      sortByName = false,
    } = call.request.params as {
      skip?: number;
      limit?: number;
      sortByName?: boolean;
    };
    const [err, externalTemplates] = await to(this.emailService.getExternalTemplates()!);
    if (!isNil(err)) {
      throw new GrpcError(status.INTERNAL, err.message);
    }
    if (!isNil(sortByName)) {
      if (sortByName) externalTemplates!.sort((a, b) => a.name.localeCompare(b.name));
      else externalTemplates!.sort((a, b) => b.name.localeCompare(a.name));
    }
    if (isNil(externalTemplates)) {
      throw new GrpcError(status.NOT_FOUND, 'No external templates could be retrieved');
    }
    let templateDocuments: TemplateDocument[] = [];
    (externalTemplates as Template[]).forEach((element: Template) => {
      templateDocuments.push({
        _id: element.id,
        name: element.name,
        subject: element.versions[0].subject,
        body: element.versions[0].body,
        createdAt: element.createdAt,
        variables: element.versions[0].variables,
      });
    });
    const count = templateDocuments.length;
    templateDocuments = templateDocuments.slice(skip, limit + skip);
    return { templateDocuments, count };
  }

  async syncExternalTemplates(): Promise<UnparsedRouterResponse> {
    let errorMessage: string | null = null;
    const externalTemplates = await this.emailService.getExternalTemplates();
    if (isNil(externalTemplates)) {
      throw new GrpcError(status.NOT_FOUND, 'No external templates could be retrieved');
    }
    const updated = [];
    for (const element of externalTemplates) {
      const templateDocument = await EmailTemplate.getInstance().findOne({
        externalId: element.id,
      });
      if (isNil(templateDocument)) {
        continue;
      }
      const synchronized = {
        name: element.name,
        subject: element.versions[0].subject,
        externalId: element.id,
        variables: element.versions[0].variables,
        body: element.versions[0].body,
      };
      const updatedTemplate = await EmailTemplate.getInstance()
        .findByIdAndUpdate(templateDocument._id, synchronized)
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        throw new GrpcError(status.INTERNAL, errorMessage);
      }
      updated.push(updatedTemplate);
    }

    return { updated, count: updated.length };
  }

  async resendEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const emailRecord = await EmailRecord.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(emailRecord)) {
      throw new GrpcError(status.NOT_FOUND, 'Email record does not exist');
    }

    return await this.emailService.sendEmail(
      typeof emailRecord.template === 'string'
        ? emailRecord.template
        : emailRecord.template?.name || '',
      {
        email: emailRecord.receiver,
        subject: (emailRecord as any).subject || '',
        body: (emailRecord as any).body || '',
        variables: (emailRecord as any).variables || {},
      },
    );
  }

  async getEmails(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query<EmailRecord> = {};
    let identifier;
    if (!isNil(call.request.params.search)) {
      if (call.request.params.search.match(/^[a-fA-F\d]{24}$/)) {
        query = { _id: call.request.params.search };
      } else {
        identifier = escapeStringRegexp(call.request.params.search);
        query = { receiver: { $regex: `.*${identifier}.*`, $options: 'i' } };
      }
    }

    const emailDocumentsPromise = EmailRecord.getInstance().findMany(query, {
      skip,
      limit,
      sort,
    });
    const totalCountPromise = EmailRecord.getInstance().countDocuments(query);
    const [emailDocuments, count] = await Promise.all([
      emailDocumentsPromise,
      totalCountPromise,
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

    return { emailDocuments, count };
  }

  async getEmail(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const emailRecord = await EmailRecord.getInstance().findOne({
      _id: call.request.urlParams.id,
    });
    if (isNil(emailRecord)) {
      throw new GrpcError(status.NOT_FOUND, 'Email record does not exist');
    }
    return { emailRecord };
  }

  // Push notification management methods
  async getNotificationTokens(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { platform, search, sort, populate } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    let query: any = {};

    if (!isNil(search)) {
      query = { $or: [{ _id: search }, { userId: search }] };
    }
    if (!isNil(platform)) {
      query[platform] = platform;
    }

    const tokens: any[] = await NotificationToken.getInstance().findMany(query, {
      skip,
      limit,
      sort,
      populate,
    });
    const count: number = await NotificationToken.getInstance().countDocuments(query);

    return { tokens, count };
  }

  async getNotificationToken(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const tokenDocuments = await NotificationToken.getInstance().findOne(
      {
        _id: call.request.urlParams.id,
      },
      { populate: call.request.queryParams.populate },
    );
    if (isNil(tokenDocuments)) {
      throw new GrpcError(status.NOT_FOUND, 'Could not find a token for user');
    }
    return { tokenDocuments };
  }

  async deleteNotificationToken(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const tokenDocument = await NotificationToken.getInstance().findOne({
      _id: call.request.urlParams.id,
    });
    if (isNil(tokenDocument)) {
      throw new GrpcError(status.NOT_FOUND, 'Token does not exist');
    }

    await NotificationToken.getInstance()
      .deleteOne({ _id: call.request.urlParams.id })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return { deleted: true };
  }

  // SMS management methods
  async getSmsMessages(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: Query<SmsRecord> = {};
    let identifier;
    if (!isNil(call.request.params.search)) {
      if (call.request.params.search.match(/^[a-fA-F\d]{24}$/)) {
        query = { _id: call.request.params.search };
      } else {
        identifier = escapeStringRegexp(call.request.params.search);
        query = { recipient: { $regex: `.*${identifier}.*`, $options: 'i' } };
      }
    }

    const smsDocumentsPromise = SmsRecord.getInstance().findMany(query, {
      skip,
      limit,
      sort,
    });
    const totalCountPromise = SmsRecord.getInstance().countDocuments(query);
    const [smsDocuments, count] = await Promise.all([
      smsDocumentsPromise,
      totalCountPromise,
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

    return { smsDocuments, count };
  }

  async getSmsMessage(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const smsRecord = await SmsRecord.getInstance().findOne({
      _id: call.request.urlParams.id,
    });
    if (isNil(smsRecord)) {
      throw new GrpcError(status.NOT_FOUND, 'SMS record does not exist');
    }
    return { smsRecord };
  }

  private registerAdminRoutes() {
    this.routingManager.clear();

    // Email routes
    this.routingManager.route(
      {
        path: '/email/send',
        action: ConduitRouteActions.POST,
        description: 'Sends email.',
        bodyParams: {
          templateName: ConduitString.Optional,
          body: ConduitString.Optional,
          subject: ConduitString.Optional,
          email: ConduitString.Required,
          variables: ConduitJson.Optional,
          sender: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('SendEmail', 'String'),
      this.sendEmail.bind(this),
    );

    // Push notification routes
    this.routingManager.route(
      {
        path: '/push/send',
        action: ConduitRouteActions.POST,
        description: 'Sends push notification.',
        bodyParams: {
          userId: ConduitString.Required,
          title: ConduitString.Required,
          body: ConduitString.Optional,
          data: ConduitJson.Optional,
          platform: ConduitString.Optional,
          doNotStore: ConduitString.Optional,
          isSilent: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('SendNotification', 'String'),
      this.sendNotification.bind(this),
    );

    // SMS routes
    this.routingManager.route(
      {
        path: '/sms/send',
        action: ConduitRouteActions.POST,
        description: 'Sends SMS.',
        bodyParams: {
          to: ConduitString.Required,
          message: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('SendSMS', 'String'),
      this.sendSms.bind(this),
    );

    // Unified communication routes
    this.routingManager.route(
      {
        path: '/send/multiple',
        action: ConduitRouteActions.POST,
        description: 'Sends message to multiple channels.',
        bodyParams: {
          channels: ConduitJson.Required,
          strategy: ConduitString.Required,
          recipient: ConduitString.Required,
          subject: ConduitString.Optional,
          body: ConduitString.Optional,
          variables: ConduitJson.Optional,
          templateName: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('SendToMultipleChannels', 'Object'),
      this.sendToMultipleChannels.bind(this),
    );

    this.routingManager.route(
      {
        path: '/send/fallback',
        action: ConduitRouteActions.POST,
        description: 'Sends message with fallback chain.',
        bodyParams: {
          fallbackChain: ConduitJson.Required,
          recipient: ConduitString.Required,
          subject: ConduitString.Optional,
          body: ConduitString.Optional,
          variables: ConduitJson.Optional,
          templateName: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('SendWithFallback', 'Object'),
      this.sendWithFallback.bind(this),
    );

    this.routingManager.route(
      {
        path: '/communications/send',
        action: ConduitRouteActions.POST,
        description: 'Sends a message on a single channel.',
        bodyParams: {
          channel: ConduitString.Required,
          recipient: ConduitString.Required,
          templateName: ConduitString.Optional,
          subject: ConduitString.Optional,
          body: ConduitString.Optional,
          variables: ConduitJson.Optional,
          sender: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('SendCommunication', 'Object'),
      this.sendCommunication.bind(this),
    );

    this.routingManager.route(
      {
        path: '/communications/templates',
        action: ConduitRouteActions.GET,
        description: 'Get unified communication templates',
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetCommunicationTemplates', {
        templateDocuments: ['CommunicationTemplate'],
        count: ConduitNumber.Required,
      }),
      this.getCommunicationTemplates.bind(this),
    );

    this.routingManager.route(
      {
        path: '/communications/templates',
        action: ConduitRouteActions.POST,
        description: 'Create unified communication template',
        bodyParams: {
          name: ConduitString.Required,
          channels: { type: [TYPE.String], required: true },
          email: ConduitJson.Optional,
          push: ConduitJson.Optional,
          sms: ConduitJson.Optional,
          variables: { type: [TYPE.String], required: false },
          templateDescription: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('CreateCommunicationTemplate', {
        template: 'CommunicationTemplate',
      }),
      this.createCommunicationTemplate.bind(this),
    );

    this.routingManager.route(
      {
        path: '/communications/templates/migrate-from-email',
        action: ConduitRouteActions.POST,
        description: 'Migrate email templates to unified communication templates',
        bodyParams: {
          emailTemplateId: ConduitString.Optional,
          dryRun: ConduitBoolean.Optional,
          skipExisting: ConduitBoolean.Optional,
          deleteSource: ConduitBoolean.Optional,
        },
      },
      new ConduitRouteReturnDefinition('MigrateFromEmailTemplate', 'Object'),
      this.migrateFromEmailTemplate.bind(this),
    );

    this.routingManager.route(
      {
        path: '/communications/templates/:id',
        action: ConduitRouteActions.GET,
        description: 'Get unified communication template by id',
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('GetCommunicationTemplate', {
        template: 'CommunicationTemplate',
      }),
      this.getCommunicationTemplate.bind(this),
    );

    this.routingManager.route(
      {
        path: '/communications/templates/:id',
        action: ConduitRouteActions.PATCH,
        description: 'Update unified communication template',
        urlParams: {
          id: ConduitString.Required,
        },
        bodyParams: {
          name: ConduitString.Optional,
          channels: { type: [TYPE.String], required: false },
          email: ConduitJson.Optional,
          push: ConduitJson.Optional,
          sms: ConduitJson.Optional,
          variables: { type: [TYPE.String], required: false },
          templateDescription: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('PatchCommunicationTemplate', {
        template: 'CommunicationTemplate',
      }),
      this.patchCommunicationTemplate.bind(this),
    );

    this.routingManager.route(
      {
        path: '/communications/templates/:id',
        action: ConduitRouteActions.DELETE,
        description: 'Delete unified communication template',
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('DeleteCommunicationTemplate', {
        deleted: ConduitBoolean.Required,
      }),
      this.deleteCommunicationTemplate.bind(this),
    );

    // Additional Email routes
    this.routingManager.route(
      {
        path: '/email/templates',
        action: ConduitRouteActions.GET,
        description: 'Get email templates',
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetTemplates', {
        templateDocuments: ['EmailTemplate'],
        count: ConduitNumber.Required,
      }),
      this.getTemplates.bind(this),
    );

    this.routingManager.route(
      {
        path: '/email/templates',
        action: ConduitRouteActions.POST,
        description: 'Create email template',
        bodyParams: {
          name: ConduitString.Required,
          subject: ConduitString.Required,
          body: ConduitString.Required,
          variables: { type: [TYPE.String], required: false },
          sender: ConduitString.Optional,
          externalManaged: ConduitBoolean.Optional,
          _id: ConduitString.Optional,
          jsonTemplate: ConduitJson.Optional,
        },
      },
      new ConduitRouteReturnDefinition('CreateTemplate', {
        template: 'EmailTemplate',
      }),
      this.createTemplate.bind(this),
    );

    this.routingManager.route(
      {
        path: '/email/templates/:id',
        action: ConduitRouteActions.PATCH,
        description: 'Update email template',
        urlParams: {
          id: ConduitString.Required,
        },
        bodyParams: {
          name: ConduitString.Optional,
          subject: ConduitString.Optional,
          body: ConduitString.Optional,
          variables: { type: [TYPE.String], required: false },
          sender: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('UpdateTemplate', 'EmailTemplate'),
      this.patchTemplate.bind(this),
    );

    this.routingManager.route(
      {
        path: '/email/templates/:id',
        action: ConduitRouteActions.DELETE,
        description: 'Delete email template',
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('DeleteTemplate', {
        deleted: ConduitBoolean.Required,
      }),
      this.deleteTemplate.bind(this),
    );

    this.routingManager.route(
      {
        path: '/email/templates/external',
        action: ConduitRouteActions.GET,
        description: 'Get external email templates',
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sortByName: ConduitBoolean.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetExternalTemplates', {
        templateDocuments: ['TemplateDocument'],
        count: ConduitNumber.Required,
      }),
      this.getExternalTemplates.bind(this),
    );

    this.routingManager.route(
      {
        path: '/email/templates/external/sync',
        action: ConduitRouteActions.POST,
        description: 'Sync external email templates',
      },
      new ConduitRouteReturnDefinition('SyncExternalTemplates', {
        updated: ['EmailTemplate'],
        count: ConduitNumber.Required,
      }),
      this.syncExternalTemplates.bind(this),
    );

    this.routingManager.route(
      {
        path: '/email/resend',
        action: ConduitRouteActions.POST,
        description: 'Resend email',
        bodyParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('ResendEmail', 'String'),
      this.resendEmail.bind(this),
    );

    this.routingManager.route(
      {
        path: '/email/emails',
        action: ConduitRouteActions.GET,
        description: 'Get sent emails',
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetEmails', {
        emailDocuments: ['EmailRecord'],
        count: ConduitNumber.Required,
      }),
      this.getEmails.bind(this),
    );

    this.routingManager.route(
      {
        path: '/email/emails/:id',
        action: ConduitRouteActions.GET,
        description: 'Get email details',
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('GetEmail', {
        emailRecord: 'EmailRecord',
      }),
      this.getEmail.bind(this),
    );

    // Additional Push notification routes
    this.routingManager.route(
      {
        path: '/push/tokens',
        action: ConduitRouteActions.GET,
        description: 'Get notification tokens',
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
          platform: ConduitString.Optional,
          populate: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('GetNotificationTokens', {
        tokens: ['NotificationToken'],
        count: ConduitNumber.Required,
      }),
      this.getNotificationTokens.bind(this),
    );

    this.routingManager.route(
      {
        path: '/push/tokens/:id',
        action: ConduitRouteActions.GET,
        description: 'Get notification token by id',
        urlParams: {
          id: ConduitString.Required,
        },
        queryParams: {
          populate: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('GetNotificationToken', 'NotificationToken'),
      this.getNotificationToken.bind(this),
    );

    this.routingManager.route(
      {
        path: '/push/tokens/:id',
        action: ConduitRouteActions.DELETE,
        description: 'Delete notification token',
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('DeleteNotificationToken', {
        deleted: ConduitBoolean.Required,
      }),
      this.deleteNotificationToken.bind(this),
    );

    // Additional SMS routes
    this.routingManager.route(
      {
        path: '/sms/messages',
        action: ConduitRouteActions.GET,
        description: 'Get sent SMS messages',
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
          search: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetSmsMessages', {
        smsDocuments: ['SmsRecord'],
        count: ConduitNumber.Required,
      }),
      this.getSmsMessages.bind(this),
    );

    this.routingManager.route(
      {
        path: '/sms/messages/:id',
        action: ConduitRouteActions.GET,
        description: 'Get SMS message details',
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('GetSmsMessage', {
        smsRecord: 'SmsRecord',
      }),
      this.getSmsMessage.bind(this),
    );

    this.routingManager.registerRoutes();
  }
}
