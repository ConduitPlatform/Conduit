import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { IChannel, IChannelSendParams, ChannelResult } from '../interfaces/index.js';
import { EmailService } from './email.service.js';
import { PushService } from './push.service.js';
import { SmsService } from './sms.service.js';

export interface IMultiChannelSendParams extends IChannelSendParams {
  channels: ('email' | 'push' | 'sms')[];
  strategy: 'BEST_EFFORT' | 'ALL_OR_NOTHING';
}

export interface IFallbackSendParams extends IChannelSendParams {
  fallbackChain: Array<{
    channel: 'email' | 'push' | 'sms';
    timeout: number;
  }>;
}

export class OrchestratorService {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private emailService: EmailService,
    private pushService: PushService,
    private smsService: SmsService,
  ) {}

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

  async sendToMultipleChannels(params: IMultiChannelSendParams): Promise<{
    results: ChannelResult[];
    successCount: number;
    failureCount: number;
  }> {
    const { channels, strategy, ...sendParams } = params;
    const results: ChannelResult[] = [];
    const availableChannels = channels.filter(channel =>
      this.getChannelService(channel).isAvailable(),
    );

    if (availableChannels.length === 0) {
      throw new Error('No available channels');
    }

    // Send to all channels in parallel
    const promises = availableChannels.map(async channel => {
      try {
        const service = this.getChannelService(channel);
        const result = await service.send(sendParams);
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

    // If strategy is ALL_OR_NOTHING and any channel failed, throw error
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
    const { fallbackChain, ...sendParams } = params;
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
        const service = this.getChannelService(channel);

        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
        });

        // Race between the service call and timeout
        const result = await Promise.race([service.send(sendParams), timeoutPromise]);

        attempts.push(result);

        if (result.success) {
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

    // If we get here, all channels failed
    throw new Error(`All fallback channels failed. Attempts: ${attempts.length}`);
  }

  async sendToChannel(
    channel: 'email' | 'push' | 'sms',
    params: IChannelSendParams,
  ): Promise<ChannelResult> {
    const service = this.getChannelService(channel);

    if (!service.isAvailable()) {
      throw new Error(`Channel ${channel} is not available`);
    }

    return service.send(params);
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
