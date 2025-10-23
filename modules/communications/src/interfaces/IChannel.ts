export interface IChannelSendParams {
  recipient: string;
  subject?: string;
  body?: string;
  variables?: Record<string, any>;
  sender?: string;
  cc?: string[];
  replyTo?: string;
  attachments?: string[];
  data?: Record<string, any>;
  platform?: string;
  doNotStore?: boolean;
  isSilent?: boolean;
}

export interface ChannelResult {
  success: boolean;
  messageId?: string;
  error?: string;
  channel: string;
}

export interface ChannelStatus {
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  messageId: string;
  timestamp?: Date;
  error?: string;
}

export interface IChannel {
  send(params: IChannelSendParams): Promise<ChannelResult>;
  sendMany(params: IChannelSendParams[]): Promise<ChannelResult[]>;
  getStatus(messageId: string): Promise<ChannelStatus>;
  isAvailable(): boolean;
}
