import { MailgunConfig } from './mailgun.config.js';
import mailgunTransport from 'nodemailer-mailgun-transport';

export function initialize(config: MailgunConfig): mailgunTransport.MailgunTransport {
  return mailgunTransport(config);
}
