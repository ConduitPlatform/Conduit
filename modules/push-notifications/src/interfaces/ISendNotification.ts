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
