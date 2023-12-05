import Mail from 'nodemailer/lib/mailer';
import { SentMessageInfo } from 'nodemailer';
import { MailgunConfig } from './transports/mailgun/mailgun.config';
import { isEmpty, isNil } from 'lodash';
import { MandrillConfig } from './transports/mandrill/mandrill.config';
import { EmailBuilderClass } from './models/EmailBuilderClass';
import { SendGridConfig } from './transports/sendgrid/sendgrid.config';
import { EmailProviderClass } from './models/EmailProviderClass';
import { MailgunProvider } from './transports/mailgun/MailgunProvider';
import { MandrillProvider } from './transports/mandrill/MandrilProvider';
import { SendgridProvider } from './transports/sendgrid/SendgridProvider';
import { SmtpProvider } from './transports/smtp/SmtpProvider';
import { ConfigController } from '@conduitplatform/module-tools';

export class EmailProvider {
  _transport?: EmailProviderClass;
  _transportName?: string;

  constructor(transport: string, transportSettings: any) {
    if (transport === 'mailgun') {
      const { apiKey, proxy, host } = transportSettings.mailgun;
      let domain = ConfigController.getInstance().config.email.sendingDomain;
      if (!isEmpty(transportSettings.mailgun.domain)) {
        domain = transportSettings.mailgun.domain;
      }
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
      this._transport = new MailgunProvider(mailgunSettings);
    } else if (transport === 'smtp') {
      this._transportName = 'smtp';

      const { smtp } = transportSettings;
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
      const mandrillSettings: MandrillConfig = {
        auth: {
          apiKey: transportSettings.mandrill.apiKey,
        },
      };
      this._transport = new MandrillProvider(mandrillSettings);
    } else if (transport === 'sendgrid') {
      this._transportName = 'sendgrid';
      const sgSettings: SendGridConfig = {
        apiKey: transportSettings['sendgrid'].apiKey,
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
}
