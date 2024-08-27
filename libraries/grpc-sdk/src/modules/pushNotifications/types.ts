export type SendNotificationParams =
  | {
      sendTo: string;
      title: string;
      body?: string;
      data?: string;
      platform?: string;
    }[]
  | [sendTo: string, title: string, body?: string, data?: string, platform?: string];

export enum SendNotificationParamEnum {
  sendTo = 'sendTo',
  title = 'title',
  body = 'body',
  data = 'data',
  platform = 'platform',
}

export type SendNotificationToManyDevicesParams =
  | {
      sendTo: string[];
      title: string;
      body?: string;
      data?: string;
      platform?: string;
    }[]
  | [sendTo: string[], title: string, body?: string, data?: string, platform?: string];

export const SendNotificationToManyDevicesParamEnum = SendNotificationParamEnum;
