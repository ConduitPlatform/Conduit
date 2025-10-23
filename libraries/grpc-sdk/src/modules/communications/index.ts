import { ConduitModule } from '../../classes/index.js';
import { CommunicationsDefinition } from '../../protoUtils/index.js';

export class Communications extends ConduitModule<typeof CommunicationsDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'communications', url, grpcToken);
    this.initializeClient(CommunicationsDefinition);
  }

  // Legacy Email methods
  registerTemplate(template: {
    name: string;
    subject: string;
    body: string;
    variables: string[];
    sender?: string;
  }) {
    return this.client!.registerTemplate({
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
      sender: template.sender,
    }).then(res => {
      return JSON.parse(res.template);
    });
  }

  updateTemplate(
    templateId: string,
    params: {
      name?: string;
      subject?: string;
      body?: string;
      variables?: string[];
      sender?: string;
    },
  ) {
    return this.client!.updateTemplate({
      id: templateId,
      name: params.name,
      subject: params.subject,
      body: params.body,
      variables: params.variables,
      sender: params.sender,
    }).then(res => {
      return JSON.parse(res.template);
    });
  }

  sendEmail(
    templateName: string,
    params: {
      email: string;
      variables: any;
      sender?: string;
      replyTo?: string;
      cc?: string[];
      attachments?: string[];
    },
  ) {
    return this.client!.sendEmail({
      templateName,
      params: {
        email: params.email,
        variables: JSON.stringify(params.variables),
        sender: params.sender,
        replyTo: params.replyTo,
        cc: params.cc ?? [],
        attachments: params.attachments ?? [],
      },
    }).then(res => {
      return res.sentMessageInfo;
    });
  }

  resendEmail(emailRecordId: string) {
    return this.client!.resendEmail({ emailRecordId }).then(res => {
      return res.sentMessageInfo;
    });
  }

  getEmailStatus(messageId: string) {
    return this.client!.getEmailStatus({ messageId }).then(res => {
      return JSON.parse(res.statusInfo);
    });
  }

  // Legacy Push Notifications methods
  setNotificationToken(token: string, platform: string, userId: string) {
    return this.client!.setNotificationToken({
      token,
      platform,
      userId,
    }).then(res => {
      return JSON.parse(res.newTokenDocument);
    });
  }

  getNotificationTokens(userId: string) {
    return this.client!.getNotificationTokens({ userId }).then(res => {
      return res.tokenDocuments.map(doc => JSON.parse(doc));
    });
  }

  sendNotification(
    sendTo: string,
    title: string,
    body?: string,
    data?: string,
    platform?: string,
  ) {
    return this.client!.sendNotification({
      sendTo,
      title,
      body,
      data,
      platform,
    });
  }

  sendNotificationToManyDevices(
    sendTo: string[],
    title: string,
    body?: string,
    data?: string,
    platform?: string,
  ) {
    return this.client!.sendNotificationToManyDevices({
      sendTo,
      title,
      body,
      data,
      platform,
    });
  }

  sendManyNotifications(
    notifications: Array<{
      sendTo: string;
      title: string;
      body?: string;
      data?: string;
      platform?: string;
    }>,
  ) {
    return this.client!.sendManyNotifications({
      notifications: notifications.map(notification => ({
        sendTo: notification.sendTo,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        platform: notification.platform,
      })),
    });
  }

  // Legacy SMS methods
  sendSms(to: string, message: string) {
    return this.client!.sendSms({ to, message });
  }

  sendVerificationCode(to: string) {
    return this.client!.sendVerificationCode({ to });
  }

  verify(verificationSid: string, code: string) {
    return this.client!.verify({ verificationSid, code });
  }

  // New unified methods
  sendMessage(
    channel: 'email' | 'push' | 'sms',
    params: {
      recipient: string;
      subject?: string;
      body?: string;
      variables?: any;
      sender?: string;
      cc?: string[];
      replyTo?: string;
      attachments?: string[];
      data?: any;
      platform?: string;
      doNotStore?: boolean;
      isSilent?: boolean;
    },
  ) {
    return this.client!.sendCommunication({
      channel,
      templateName: '', // Not used for direct sending
      params: {
        recipient: params.recipient,
        subject: params.subject,
        body: params.body,
        variables: JSON.stringify(params.variables || {}),
        sender: params.sender,
        cc: params.cc ?? [],
        replyTo: params.replyTo,
        attachments: params.attachments ?? [],
        data: JSON.stringify(params.data || {}),
        platform: params.platform,
        doNotStore: params.doNotStore,
        isSilent: params.isSilent,
      },
    }).then(res => {
      return {
        messageId: res.messageId,
        sentMessageInfo: JSON.parse(res.sentMessageInfo),
      };
    });
  }

  sendToMultipleChannels(
    channels: ('email' | 'push' | 'sms')[],
    strategy: 'BEST_EFFORT' | 'ALL_OR_NOTHING',
    params: {
      recipient: string;
      subject?: string;
      body?: string;
      variables?: any;
      sender?: string;
      cc?: string[];
      replyTo?: string;
      attachments?: string[];
      data?: any;
      platform?: string;
      doNotStore?: boolean;
      isSilent?: boolean;
    },
  ) {
    return this.client!.sendToMultipleChannels({
      channels,
      strategy,
      templateName: '', // Not used for direct sending
      params: {
        recipient: params.recipient,
        subject: params.subject,
        body: params.body,
        variables: JSON.stringify(params.variables || {}),
        sender: params.sender,
        cc: params.cc ?? [],
        replyTo: params.replyTo,
        attachments: params.attachments ?? [],
        data: JSON.stringify(params.data || {}),
        platform: params.platform,
        doNotStore: params.doNotStore,
        isSilent: params.isSilent,
      },
    }).then(res => {
      return res.results;
    });
  }

  sendWithFallback(
    fallbackChain: Array<{
      channel: 'email' | 'push' | 'sms';
      timeout: number;
    }>,
    params: {
      recipient: string;
      subject?: string;
      body?: string;
      variables?: any;
      sender?: string;
      cc?: string[];
      replyTo?: string;
      attachments?: string[];
      data?: any;
      platform?: string;
      doNotStore?: boolean;
      isSilent?: boolean;
    },
  ) {
    return this.client!.sendWithFallback({
      fallbackChain,
      templateName: '', // Not used for direct sending
      params: {
        recipient: params.recipient,
        subject: params.subject,
        body: params.body,
        variables: JSON.stringify(params.variables || {}),
        sender: params.sender,
        cc: params.cc ?? [],
        replyTo: params.replyTo,
        attachments: params.attachments ?? [],
        data: JSON.stringify(params.data || {}),
        platform: params.platform,
        doNotStore: params.doNotStore,
        isSilent: params.isSilent,
      },
    }).then(res => {
      return {
        successfulChannel: res.successfulChannel,
        messageId: res.messageId,
        attempts: res.attempts,
      };
    });
  }

  getMessageStatus(channel: 'email' | 'push' | 'sms', messageId: string) {
    return this.client!.getMessageStatus({
      messageId,
      channel,
    }).then(res => {
      return JSON.parse(res.statusInfo);
    });
  }
}
