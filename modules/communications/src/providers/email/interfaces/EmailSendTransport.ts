export interface EmailSendTransport {
  subject: string;
  body: string;
  from: string;
  to: string;
  bcc?: string;
  cc?: string;
}
