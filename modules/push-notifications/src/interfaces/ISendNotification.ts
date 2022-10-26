export interface ISendNotification {
  sendTo: string;
  title: string;
  type?: string;
  body?: string;
  platform?: string;
  data?: { [key: string]: string };
}

export interface ISendNotificationToManyDevices {
  sendTo: string[]; // this can be userIds, segments etc for different notification service providers
  type?: string;
  title: string;
  body?: string;
  platform?: string;
  data?: { [key: string]: string };
}
