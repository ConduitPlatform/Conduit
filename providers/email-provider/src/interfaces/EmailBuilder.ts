import { EmailOptions } from './EmailOptions';

export interface EmailBuilder {
  getMailObject(): EmailOptions;

  setSender(sender: string): EmailBuilder;

  getSender(): string | undefined;

  setReceiver(receiver: string | string[], clearReceiver?: boolean): EmailBuilder;

  getReceiver(): string | string[] | undefined;

  setCC(cc: string | string[], clearCC?: boolean): EmailBuilder;

  getCC(): string | string[] | undefined;

  setSubject(subject: string): EmailBuilder;

  getSubject(): string | undefined;

  setBCC(bcc: string | string[], clearBCC?: boolean): EmailBuilder;

  getBCC(): string | string[] | undefined;

  setReplyTo(replyTo: string): EmailBuilder;

  getReplyTo(replyTo: string): string | undefined;

  setContent(content: string): EmailBuilder;

  getContent(): string | undefined;

  addAttachments(attachments: string[]): EmailBuilder;

  getAttachments(): string[] | undefined;
}
