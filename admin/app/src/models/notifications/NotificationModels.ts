export interface NotificationData {
  userIds: string[];
  title: string;
  body: string;
}

export interface INotificationSettings {
  active: boolean;
  providerName: string;
  firebase: FirebaseSettings;
  message?: string;
}

export enum INotificationProviders {
  firebase = 'firebase',
}

export interface INotificationProviderSettings {
  firebase: FirebaseSettings;
}

export interface FirebaseSettings {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}
