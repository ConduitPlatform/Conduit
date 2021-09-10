export interface NotificationData {
  userId: string;
  title: string;
  data: string;
  body: string;
}

export interface INotificationSettings {
  active: boolean;
  providerName: string;
  projectId: string;
  privateKey: string;
  clientEmail: string;
  message?: string;
}
