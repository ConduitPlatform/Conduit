import { initialize as initializeMailgun } from './transports/mailgun/mailgun';
import Mail from 'nodemailer/lib/mailer';
import { MailgunMailBuilder } from './transports/mailgun/mailgunMailBuilder';
import { NodemailerBuilder } from './transports/nodemailer/nodemailerBuilder';
import { EmailBuilder } from './interfaces/EmailBuilder';
import { createTransport, SentMessageInfo } from 'nodemailer';
import { MailgunConfig } from './transports/mailgun/mailgun.config';
import { EmailOptions } from './interfaces/EmailOptions';
import { isNil } from 'lodash';

export class EmailProvider {
  _transport?: Mail;
  _transportName?: string;

  constructor(transport: string, transportSettings: any) {
    if (transport === 'mailgun') {
      this._transportName = 'mailgun';

      const { apiKey, domain, proxy, host } = transportSettings.mailgun;

      if (isNil(apiKey) || isNil(domain) || isNil(host)) {
        throw new Error('Mailgun transport settings are missing');
      }
      const mailgunSettings: MailgunConfig = {
        auth: {
          api_key: apiKey,
          domain,
        },
        proxy,
        host,
      };

      this._transport = createTransport(initializeMailgun(mailgunSettings));
    } else if (transport === 'smtp') {
      this._transportName = 'smtp';

      const { smtp } = transportSettings;

      this._transport = createTransport({
        ...transportSettings,
        secure: false,
        ...smtp,
        tls: {
          rejectUnauthorized: false,
        },
      });
    } else {
      this._transportName = undefined;
      this._transport = undefined;
      throw new Error('You need to specify a correct transport');
    }
  }

  sendEmailDirect(mailOptions: EmailOptions): Promise<SentMessageInfo> {
    if (!this._transport) {
      throw new Error('Email  transport not initialized!');
    }
    return this._transport.sendMail(mailOptions);
  }

  emailBuilder(): EmailBuilder {
    if (!this._transport) {
      throw new Error('Email  transport not initialized!');
    }
    if (this._transportName === 'mailgun') {
      return new MailgunMailBuilder();
    } else {
      return new NodemailerBuilder();
    }
  }

  sendEmail(email: EmailBuilder): Promise<SentMessageInfo> {
    if (!this._transport) {
      throw new Error('Email  transport not initialized!');
    }
    return this._transport.sendMail(email.getMailObject());
  }
}
