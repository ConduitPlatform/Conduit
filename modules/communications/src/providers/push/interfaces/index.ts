export interface ISendNotification {
  sendTo: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  platform?: string;
  doNotStore?: boolean;
  isSilent?: boolean;
}

export interface ISendNotificationToManyDevices {
  sendTo: string[];
  title?: string;
  body?: string;
  data?: Record<string, any>;
  platform?: string;
  doNotStore?: boolean;
  isSilent?: boolean;
}

export interface IPushTokenTarget {
  token: string;
  platform: string;
}

export interface IPushSendFailure {
  token: string;
  platform?: string;
  error?: unknown;
  reason?: string;
}

export interface IPushBatchResult {
  successCount: number;
  failureCount: number;
  failures: IPushSendFailure[];
}

export interface IPushSendAggregateResult {
  requestedCount: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
}
