import handlebars from 'handlebars';
import { isEmpty, isNil } from 'lodash-es';
import { ConduitGrpcSdk, GrpcError, Query } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { CommunicationTemplate, EmailTemplate } from '../models/index.js';
import { getHandleBarsValues } from '../providers/email/utils/index.js';
import { IChannelSendParams } from '../interfaces/index.js';

export type CommunicationChannel = 'email' | 'push' | 'sms';

export interface ICreateCommunicationTemplateParams {
  name: string;
  channels: CommunicationChannel[];
  email?: {
    subject?: string;
    body?: string;
    sender?: string;
  };
  push?: {
    title?: string;
    body?: string;
  };
  sms?: {
    message?: string;
  };
  variables?: string[];
  summary?: string;
}

export interface IUpdateCommunicationTemplateParams {
  name?: string;
  channels?: CommunicationChannel[];
  email?: {
    subject?: string;
    body?: string;
    sender?: string;
  };
  push?: {
    title?: string;
    body?: string;
  };
  sms?: {
    message?: string;
  };
  variables?: string[];
  summary?: string;
}

export interface IResolvedTemplateParams {
  subject?: string;
  body?: string;
  sender?: string;
  /** When set, email send should use EmailService.sendEmail for external-managed templates */
  emailTemplateName?: string;
}

const CHANNELS: CommunicationChannel[] = ['email', 'push', 'sms'];

export class CommunicationTemplateService {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async create(params: ICreateCommunicationTemplateParams) {
    const validated = this.validateTemplatePayload(params);
    await this.assertNameAvailable(validated.name);

    const variables =
      params.variables && params.variables.length > 0
        ? params.variables
        : this.extractVariables(validated);

    const doc = await CommunicationTemplate.getInstance()
      .create({
        ...validated,
        variables,
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    ConduitGrpcSdk.Metrics?.increment('communication_templates_total');
    return doc;
  }

  async update(id: string, params: IUpdateCommunicationTemplateParams) {
    const existing = await CommunicationTemplate.getInstance().findOne({ _id: id });
    if (isNil(existing)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
    }

    const merged: ICreateCommunicationTemplateParams = {
      name: params.name ?? existing.name,
      channels: params.channels ?? existing.channels,
      email: params.email ?? existing.email,
      push: params.push ?? existing.push,
      sms: params.sms ?? existing.sms,
      summary: params.summary ?? (existing as { summary?: string }).summary,
      variables: params.variables,
    };

    if (params.name && params.name !== existing.name) {
      await this.assertNameAvailable(params.name, id);
    }

    const validated = this.validateTemplatePayload(merged);
    const variables =
      params.variables && params.variables.length > 0
        ? params.variables
        : this.extractVariables(validated);

    const updated = await CommunicationTemplate.getInstance()
      .findByIdAndUpdate(id, { ...validated, variables })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    return updated;
  }

  async delete(id: string) {
    const existing = await CommunicationTemplate.getInstance().findOne({ _id: id });
    if (isNil(existing)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
    }

    await CommunicationTemplate.getInstance()
      .deleteOne({ _id: id })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    ConduitGrpcSdk.Metrics?.decrement('communication_templates_total');
    return { deleted: true };
  }

  async getById(id: string) {
    const doc = await CommunicationTemplate.getInstance().findOne({ _id: id });
    if (isNil(doc)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
    }
    return doc;
  }

  async getByName(name: string) {
    return CommunicationTemplate.getInstance().findOne({ name });
  }

  async list(
    query: Query<CommunicationTemplate>,
    pagination: { skip?: number; limit?: number; sort?: string },
  ) {
    const [documents, count] = await Promise.all([
      CommunicationTemplate.getInstance().findMany(query, pagination),
      CommunicationTemplate.getInstance().countDocuments(query),
    ]);
    return { documents, count };
  }

  async resolve(
    templateName: string,
    channel: CommunicationChannel,
    variables: Record<string, unknown> = {},
  ): Promise<IResolvedTemplateParams> {
    const unified = await this.getByName(templateName);
    if (unified) {
      if (!unified.channels.includes(channel)) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          `Template '${templateName}' does not include channel '${channel}'`,
        );
      }
      return this.renderUnifiedChannel(unified, channel, variables);
    }

    if (channel === 'email') {
      const emailTemplate = await EmailTemplate.getInstance().findOne({
        name: templateName,
      });
      if (emailTemplate) {
        if (emailTemplate.externalManaged) {
          return { emailTemplateName: templateName };
        }
        return {
          subject: emailTemplate.subject
            ? handlebars.compile(emailTemplate.subject)(variables)
            : undefined,
          body: emailTemplate.body
            ? handlebars.compile(emailTemplate.body)(variables)
            : undefined,
          sender: emailTemplate.sender,
        };
      }
    }

    throw new GrpcError(status.NOT_FOUND, `Template '${templateName}' not found`);
  }

  async resolveAll(
    templateName: string,
    variables: Record<string, unknown> = {},
  ): Promise<Partial<Record<CommunicationChannel, IResolvedTemplateParams>>> {
    const unified = await this.getByName(templateName);
    if (unified) {
      const result: Partial<Record<CommunicationChannel, IResolvedTemplateParams>> = {};
      for (const channel of unified.channels) {
        result[channel] = this.renderUnifiedChannel(unified, channel, variables);
      }
      return result;
    }

    const emailTemplate = await EmailTemplate.getInstance().findOne({
      name: templateName,
    });
    if (emailTemplate) {
      if (emailTemplate.externalManaged) {
        return { email: { emailTemplateName: templateName } };
      }
      return {
        email: {
          subject: emailTemplate.subject
            ? handlebars.compile(emailTemplate.subject)(variables)
            : undefined,
          body: emailTemplate.body
            ? handlebars.compile(emailTemplate.body)(variables)
            : undefined,
          sender: emailTemplate.sender,
        },
      };
    }

    throw new GrpcError(status.NOT_FOUND, `Template '${templateName}' not found`);
  }

  mergeWithRequest(
    baseParams: IChannelSendParams,
    resolved: IResolvedTemplateParams,
  ): IChannelSendParams & { emailTemplateName?: string } {
    if (resolved.emailTemplateName) {
      return { ...baseParams, emailTemplateName: resolved.emailTemplateName };
    }

    return {
      ...baseParams,
      subject: !isEmpty(baseParams.subject) ? baseParams.subject : resolved.subject,
      body: !isEmpty(baseParams.body) ? baseParams.body : resolved.body,
      sender: !isEmpty(baseParams.sender) ? baseParams.sender : resolved.sender,
    };
  }

  validateForImport(record: Record<string, unknown>): ICreateCommunicationTemplateParams {
    return this.validateTemplatePayload(
      record as unknown as ICreateCommunicationTemplateParams,
    );
  }

  async migrateFromEmailTemplate(options: {
    emailTemplateId?: string;
    dryRun?: boolean;
    skipExisting?: boolean;
    deleteSource?: boolean;
  }) {
    const { emailTemplateId, dryRun, skipExisting, deleteSource } = options;
    const query = emailTemplateId ? { _id: emailTemplateId } : {};
    const emailTemplates = await EmailTemplate.getInstance().findMany(query);

    const planned: Array<{
      sourceId: string;
      sourceName: string;
      target: ICreateCommunicationTemplateParams;
      skipped?: boolean;
      warning?: string;
    }> = [];

    for (const emailTemplate of emailTemplates) {
      const existing = await this.getByName(emailTemplate.name);
      if (existing) {
        if (skipExisting) {
          planned.push({
            sourceId: emailTemplate._id,
            sourceName: emailTemplate.name,
            target: {
              name: emailTemplate.name,
              channels: ['email'],
              email: {
                subject: emailTemplate.subject,
                body: emailTemplate.body,
                sender: emailTemplate.sender,
              },
              variables: emailTemplate.variables,
            },
            skipped: true,
          });
          continue;
        }
        throw new GrpcError(
          status.ALREADY_EXISTS,
          `Unified template '${emailTemplate.name}' already exists`,
        );
      }

      const warning = emailTemplate.externalManaged
        ? 'Source template is external-managed; unified template will be Conduit-managed only'
        : undefined;

      const target: ICreateCommunicationTemplateParams = {
        name: emailTemplate.name,
        channels: ['email'],
        email: {
          subject: emailTemplate.subject,
          body: emailTemplate.body,
          sender: emailTemplate.sender,
        },
        variables: emailTemplate.variables,
      };

      planned.push({
        sourceId: emailTemplate._id,
        sourceName: emailTemplate.name,
        target,
        warning,
      });
    }

    if (dryRun) {
      return { dryRun: true, planned, created: 0 };
    }

    const created = [];
    for (const item of planned) {
      if (item.skipped) continue;
      const doc = await this.createMigratedTemplate(item.target);
      created.push(doc);
      if (deleteSource) {
        await EmailTemplate.getInstance().deleteOne({ _id: item.sourceId });
        ConduitGrpcSdk.Metrics?.decrement('email_templates_total');
      }
    }

    return { dryRun: false, planned, created, count: created.length };
  }

  private async createMigratedTemplate(params: ICreateCommunicationTemplateParams) {
    const validated = this.validateTemplatePayload(params);
    await this.assertUnifiedNameAvailable(validated.name);

    const variables =
      params.variables && params.variables.length > 0
        ? params.variables
        : this.extractVariables(validated);

    const doc = await CommunicationTemplate.getInstance()
      .create({
        ...validated,
        variables,
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    ConduitGrpcSdk.Metrics?.increment('communication_templates_total');
    return doc;
  }

  private renderUnifiedChannel(
    template: CommunicationTemplate,
    channel: CommunicationChannel,
    variables: Record<string, unknown>,
  ): IResolvedTemplateParams {
    switch (channel) {
      case 'email': {
        const email = template.email;
        if (!email?.subject || !email?.body) {
          throw new GrpcError(
            status.INVALID_ARGUMENT,
            `Template '${template.name}' email channel is incomplete`,
          );
        }
        return {
          subject: handlebars.compile(email.subject)(variables),
          body: handlebars.compile(email.body)(variables),
          sender: email.sender,
        };
      }
      case 'push': {
        const push = template.push;
        if (!push?.title || !push?.body) {
          throw new GrpcError(
            status.INVALID_ARGUMENT,
            `Template '${template.name}' push channel is incomplete`,
          );
        }
        return {
          subject: handlebars.compile(push.title)(variables),
          body: handlebars.compile(push.body)(variables),
        };
      }
      case 'sms': {
        const sms = template.sms;
        if (!sms?.message) {
          throw new GrpcError(
            status.INVALID_ARGUMENT,
            `Template '${template.name}' sms channel is incomplete`,
          );
        }
        return {
          body: handlebars.compile(sms.message)(variables),
        };
      }
      default: {
        const _exhaustive: never = channel;
        throw new GrpcError(status.INVALID_ARGUMENT, `Unknown channel: ${_exhaustive}`);
      }
    }
  }

  private validateTemplatePayload(
    params: ICreateCommunicationTemplateParams,
  ): ICreateCommunicationTemplateParams {
    if (!params.name || isEmpty(params.name.trim())) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Template name is required');
    }

    if (!params.channels || params.channels.length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'At least one channel is required');
    }

    const uniqueChannels = [...new Set(params.channels)];
    if (uniqueChannels.length !== params.channels.length) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Duplicate channels are not allowed');
    }

    for (const ch of params.channels) {
      if (!CHANNELS.includes(ch)) {
        throw new GrpcError(status.INVALID_ARGUMENT, `Invalid channel: ${ch}`);
      }
    }

    const result: ICreateCommunicationTemplateParams = {
      name: params.name.trim(),
      channels: params.channels,
      summary: params.summary,
    };

    if (params.channels.includes('email')) {
      if (!params.email?.subject || !params.email?.body) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          'Email channel requires subject and body',
        );
      }
      result.email = {
        subject: params.email.subject,
        body: params.email.body,
        sender: params.email.sender,
      };
    }

    if (params.channels.includes('push')) {
      if (!params.push?.title || !params.push?.body) {
        throw new GrpcError(
          status.INVALID_ARGUMENT,
          'Push channel requires title and body',
        );
      }
      result.push = {
        title: params.push.title,
        body: params.push.body,
      };
    }

    if (params.channels.includes('sms')) {
      if (!params.sms?.message) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'SMS channel requires message');
      }
      result.sms = { message: params.sms.message };
    }

    return result;
  }

  private extractVariables(params: ICreateCommunicationTemplateParams): string[] {
    const vars = new Set<string>();

    if (params.email?.subject) {
      Object.keys(getHandleBarsValues(params.email.subject)).forEach(v => vars.add(v));
    }
    if (params.email?.body) {
      Object.keys(getHandleBarsValues(params.email.body)).forEach(v => vars.add(v));
    }
    if (params.push?.title) {
      Object.keys(getHandleBarsValues(params.push.title)).forEach(v => vars.add(v));
    }
    if (params.push?.body) {
      Object.keys(getHandleBarsValues(params.push.body)).forEach(v => vars.add(v));
    }
    if (params.sms?.message) {
      Object.keys(getHandleBarsValues(params.sms.message)).forEach(v => vars.add(v));
    }

    return [...vars];
  }

  private async assertUnifiedNameAvailable(name: string, excludeId?: string) {
    const unified = await CommunicationTemplate.getInstance().findOne({ name });

    if (unified && unified._id !== excludeId) {
      throw new GrpcError(
        status.ALREADY_EXISTS,
        `A unified template named '${name}' already exists`,
      );
    }
  }

  private async assertNameAvailable(name: string, excludeId?: string) {
    await this.assertUnifiedNameAvailable(name, excludeId);

    const email = await EmailTemplate.getInstance().findOne({ name });
    if (email) {
      throw new GrpcError(
        status.ALREADY_EXISTS,
        `An email template named '${name}' already exists. Migrate or rename before creating a unified template.`,
      );
    }
  }
}
