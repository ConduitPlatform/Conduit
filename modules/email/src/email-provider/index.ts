import Mail from 'nodemailer/lib/mailer';
import { SentMessageInfo } from 'nodemailer';
import { MailgunConfig } from './transports/mailgun/mailgun.config.js';
import { isEmpty } from 'lodash-es';
import { MandrillConfig } from './transports/mandrill/mandrill.config.js';
import { EmailBuilderClass } from './models/EmailBuilderClass.js';
import { SendGridConfig } from './transports/sendgrid/sendgrid.config.js';
import { EmailProviderClass } from './models/EmailProviderClass.js';
import { MailgunProvider } from './transports/mailgun/MailgunProvider.js';
import { MandrillProvider } from './transports/mandrill/MandrilProvider.js';
import { SendgridProvider } from './transports/sendgrid/SendgridProvider.js';
import { SmtpProvider } from './transports/smtp/SmtpProvider.js';
import { ConfigController } from '@conduitplatform/module-tools';
import { Indexable } from '@conduitplatform/grpc-sdk';

export class EmailProvider {
  _transport?: EmailProviderClass;
  _transportName?: string;

  constructor(transport: string, transportSettings: any) {
    if (transport === 'mailgun') {
      this._transportName = 'mailgun';
      const { apiKey, proxy, host } = transportSettings.mailgun;
      let domain = ConfigController.getInstance().config.sendingDomain;
      if (!isEmpty(transportSettings.mailgun.domain)) {
        domain = transportSettings.mailgun.domain;
      }
      if (isEmpty(apiKey) || isEmpty(domain) || isEmpty(host)) {
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
      this._transport = new MailgunProvider(mailgunSettings);
    } else if (transport === 'smtp') {
      this._transportName = 'smtp';

      const { smtp } = transportSettings;
      const { port, host } = smtp;
      if (isEmpty(port) || isEmpty(host)) {
        throw new Error('Smtp transport settings are missing');
      }
      smtp.auth.user = smtp.auth.username;
      smtp.auth.pass = smtp.auth.password;
      if (smtp.ignoreTls) {
        smtp.tls = {
          rejectUnauthorized: false,
        };
        delete smtp.ignoreTls;
      }
      delete smtp.auth.method;
      delete smtp.auth.username;
      delete smtp.auth.password;

      this._transport = new SmtpProvider({
        ...smtp,
      });
    } else if (transport === 'mandrill') {
      this._transportName = 'mandrill';
      const { apiKey } = transportSettings.mandrill.apiKey;
      if (isEmpty(apiKey)) {
        throw new Error('Mandrill transport settings are missing');
      }
      const mandrillSettings: MandrillConfig = {
        auth: { apiKey },
      };
      this._transport = new MandrillProvider(mandrillSettings);
    } else if (transport === 'sendgrid') {
      this._transportName = 'sendgrid';
      const { residency, apiKey } = transportSettings.sendgrid;
      if (isEmpty(apiKey) || isEmpty(residency)) {
        throw new Error('Sendgrid transport settings are missing');
      }
      const sgSettings: SendGridConfig = {
        apiKey,
        residency,
      };
      this._transport = new SendgridProvider(sgSettings);
    } else {
      this._transportName = undefined;
      this._transport = undefined;
      throw new Error('You need to specify a correct transport');
    }
  }

  emailBuilder(): EmailBuilderClass<Mail.Options> {
    if (!this._transport) {
      throw new Error('Email  transport not initialized!');
    }
    return this._transport.getBuilder();
  }

  sendEmail(
    email: EmailBuilderClass<Mail.Options>,
  ): Promise<SentMessageInfo> | undefined {
    if (!this._transport) {
      throw new Error('Email  transport not initialized!');
    }
    return this._transport.sendEmail(email.getMailObject());
  }

  getEmailStatus(messageId: string): Promise<Indexable> {
    if (!this._transport) {
      throw new Error('Email transport not initialized!');
    }
    return this._transport.getEmailStatus(messageId);
  }
}
