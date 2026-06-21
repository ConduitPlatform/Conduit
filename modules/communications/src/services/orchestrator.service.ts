import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { IChannel, IChannelSendParams, ChannelResult } from '../interfaces/index.js';
import { EmailService } from './email.service.js';
import { PushService } from './push.service.js';
import { SmsService } from './sms.service.js';
import { CommunicationTemplateService } from './communication-template.service.js';

export interface IMultiChannelSendParams extends IChannelSendParams {
  channels: ('email' | 'push' | 'sms')[];
  strategy: 'BEST_EFFORT' | 'ALL_OR_NOTHING';
  templateName?: string;
}

export interface IFallbackSendParams extends IChannelSendParams {
  fallbackChain: Array<{
    channel: 'email' | 'push' | 'sms';
    timeout: number;
  }>;
  templateName?: string;
}

export type OrchestratorSendParams = IChannelSendParams & {
  templateName?: string;
};

export class OrchestratorService {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private emailService: EmailService,
    private pushService: PushService,
    private smsService: SmsService,
    private templateService?: CommunicationTemplateService,
  ) {}

  setTemplateService(templateService: CommunicationTemplateService) {
    this.templateService = templateService;
  }

  updateServices(
    emailService: EmailService,
    pushService: PushService,
    smsService: SmsService,
  ) {
    this.emailService = emailService;
    this.pushService = pushService;
    this.smsService = smsService;
  }

  private getChannelService(channel: 'email' | 'push' | 'sms'): IChannel {
    switch (channel) {
      case 'email':
        return this.emailService;
      case 'push':
        return this.pushService;
      case 'sms':
        return this.smsService;
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }

  private async resolveParamsForChannel(
    channel: 'email' | 'push' | 'sms',
    params: OrchestratorSendParams,
  ): Promise<IChannelSendParams & { emailTemplateName?: string }> {
    if (!params.templateName || !this.templateService) {
      return params;
    }

    const resolved = await this.templateService.resolve(
      params.templateName,
      channel,
      params.variables ?? {},
    );
    return this.templateService.mergeWithRequest(params, resolved);
  }

  private async sendOnChannel(
    channel: 'email' | 'push' | 'sms',
    params: IChannelSendParams & { emailTemplateName?: string },
  ): Promise<ChannelResult> {
    if (channel === 'email' && params.emailTemplateName) {
      try {
        const result = await this.emailService.sendEmail(params.emailTemplateName, {
          email: params.recipient,
          subject: params.subject,
          body: params.body,
          variables: params.variables,
          sender: params.sender,
          cc: params.cc,
          replyTo: params.replyTo,
        });
        return {
          success: true,
          messageId: result.messageId,
          channel: 'email',
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
          channel: 'email',
        };
      }
    }

    const service = this.getChannelService(channel);
    return service.send(params);
  }

  private trackSendMetrics(results: ChannelResult[]) {
    ConduitGrpcSdk.Metrics?.increment('communications_sent_total', results.length);
    for (const result of results) {
      if (result.success) {
        ConduitGrpcSdk.Metrics?.increment('communications_success_total');
      } else {
        ConduitGrpcSdk.Metrics?.increment('communications_failure_total');
      }
    }
  }

  async sendToMultipleChannels(params: IMultiChannelSendParams): Promise<{
    results: ChannelResult[];
    successCount: number;
    failureCount: number;
  }> {
    const { channels, strategy, templateName, ...sendParams } = params;
    const results: ChannelResult[] = [];
    const availableChannels = channels.filter(channel =>
      this.getChannelService(channel).isAvailable(),
    );

    if (availableChannels.length === 0) {
      throw new Error('No available channels');
    }

    const promises = availableChannels.map(async channel => {
      try {
        const resolvedParams = await this.resolveParamsForChannel(channel, {
          ...sendParams,
          templateName,
        });
        const result = await this.sendOnChannel(channel, resolvedParams);
        results.push(result);
        return result;
      } catch (error) {
        const result: ChannelResult = {
          success: false,
          error: (error as Error).message,
          channel,
        };
        results.push(result);
        return result;
      }
    });

    const channelResults = await Promise.all(promises);
    const successCount = channelResults.filter(r => r.success).length;
    const failureCount = channelResults.filter(r => !r.success).length;

    this.trackSendMetrics(channelResults);

    if (strategy === 'ALL_OR_NOTHING' && failureCount > 0) {
      const failedChannels = channelResults.filter(r => !r.success).map(r => r.channel);
      throw new Error(`Failed to send to channels: ${failedChannels.join(', ')}`);
    }

    return {
      results,
      successCount,
      failureCount,
    };
  }

  async sendWithFallback(params: IFallbackSendParams): Promise<{
    successfulChannel: string;
    messageId?: string;
    attempts: ChannelResult[];
  }> {
    const { fallbackChain, templateName, ...sendParams } = params;
    const attempts: ChannelResult[] = [];

    for (const step of fallbackChain) {
      const { channel, timeout } = step;

      if (!this.getChannelService(channel).isAvailable()) {
        const result: ChannelResult = {
          success: false,
          error: `Channel ${channel} is not available`,
          channel,
        };
        attempts.push(result);
        continue;
      }

      try {
        const resolvedParams = await this.resolveParamsForChannel(channel, {
          ...sendParams,
          templateName,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
        });

        const result = await Promise.race([
          this.sendOnChannel(channel, resolvedParams),
          timeoutPromise,
        ]);

        attempts.push(result);

        if (result.success) {
          this.trackSendMetrics(attempts);
          ConduitGrpcSdk.Metrics?.increment('fallback_chain_used_total');
          return {
            successfulChannel: channel,
            messageId: result.messageId,
            attempts,
          };
        }
      } catch (error) {
        const result: ChannelResult = {
          success: false,
          error: (error as Error).message,
          channel,
        };
        attempts.push(result);
      }
    }

    this.trackSendMetrics(attempts);
    throw new Error(`All fallback channels failed. Attempts: ${attempts.length}`);
  }

  async sendToChannel(
    channel: 'email' | 'push' | 'sms',
    params: OrchestratorSendParams,
  ): Promise<ChannelResult> {
    const service = this.getChannelService(channel);

    if (!service.isAvailable()) {
      throw new Error(`Channel ${channel} is not available`);
    }

    const resolvedParams = await this.resolveParamsForChannel(channel, params);
    const result = await this.sendOnChannel(channel, resolvedParams);
    this.trackSendMetrics([result]);
    return result;
  }

  getAvailableChannels(): ('email' | 'push' | 'sms')[] {
    const channels: ('email' | 'push' | 'sms')[] = [];

    if (this.emailService.isAvailable()) {
      channels.push('email');
    }
    if (this.pushService.isAvailable()) {
      channels.push('push');
    }
    if (this.smsService.isAvailable()) {
      channels.push('sms');
    }

    return channels;
  }

  async getChannelStatus(channel: 'email' | 'push' | 'sms', messageId: string) {
    const service = this.getChannelService(channel);
    return service.getStatus(messageId);
  }
}
