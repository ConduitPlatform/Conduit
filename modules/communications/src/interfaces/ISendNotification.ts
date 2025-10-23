export interface ISendNotification {
  sendTo: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  platform?: string;
  doNotStore?: boolean;
  isSilent?: boolean;
}
