export interface ISendNotification {
  sendTo: string;
  title?: string;
  body?: string;
  platform?: string;
  data?: { [key: string]: string };
  isSilent?: boolean;
  doNotStore?: boolean;
}

export interface ISendNotificationToManyDevices {
  sendTo: string[]; // this can be userIds, segments etc for different notification service providers
  title?: string;
  body?: string;
  platform?: string;
  isSilent?: boolean;
  data?: { [key: string]: string };
  doNotStore?: boolean;
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
