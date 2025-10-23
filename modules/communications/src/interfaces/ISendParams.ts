export interface ISendParams {
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

export interface IMultiChannelSendParams extends ISendParams {
  channels: ('email' | 'push' | 'sms')[];
  strategy: 'BEST_EFFORT' | 'ALL_OR_NOTHING';
}

export interface IFallbackSendParams extends ISendParams {
  fallbackChain: Array<{
    channel: 'email' | 'push' | 'sms';
    timeout: number;
  }>;
}
