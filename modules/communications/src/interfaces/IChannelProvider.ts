import { IChannel } from './IChannel.js';

export interface IChannelProvider {
  getChannel(channelType: 'email' | 'push' | 'sms'): IChannel;
  isChannelAvailable(channelType: 'email' | 'push' | 'sms'): boolean;
  getAvailableChannels(): ('email' | 'push' | 'sms')[];
}
