export interface ISendNotification {

  userId: string;
  title: string;
  type?: string;
  body?: string;
  data?: { [key: string]: string };
}

export interface ISendNotificationToManyDevices {

  userIds: string[];
  type?: string;
  title: string;
  body?: string;
  data?: { [key: string]: string };
}
