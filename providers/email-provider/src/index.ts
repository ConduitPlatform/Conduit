import Mail from 'nodemailer/lib/mailer';
import { MailgunMailBuilder } from './transports/mailgun/mailgunMailBuilder';
import { NodemailerBuilder } from './transports/nodemailer/nodemailerBuilder';
import { SentMessageInfo } from 'nodemailer';
import { MailgunConfig } from './transports/mailgun/mailgun.config';
import { isNil, template, times } from 'lodash';
import { MandrillConfig } from './transports/mandrill/mandrill.config';
import { Mandrill } from 'mandrill-api';
import { MandrillBuilder } from './transports/mandrill/mandrillBuilder';
import { EmailBuilderClass } from './models/EmailBuilderClass';
import { MandrillEmailOptions } from './interfaces/MandrillEmailOptions';
import { SendGridConfig } from './transports/sendgrid/sendgrid.config';
import { SendgridMailBuilder } from './transports/sendgrid/sendgridMailBuilder';
import { EmailProviderClass } from './models/EmailProviderClass';
import { MailgunProvider } from './transports/mailgun/MailgunProvider';
import { MandrillProvider } from './transports/mandrill/MandrilProvider';
import { SendgridProvider } from './transports/sendgrid/SendgridProvider';
import { SmtpProvider } from './transports/smtp/SmtpProvider';

var mandrillTransport = require('nodemailer-mandrill-transport');
var sgTransport = require('nodemailer-sendgrid');

export class EmailProvider {
  _transport?: EmailProviderClass;
  _mandrillTransport?: Mandrill;
  _transportName?: string;

  constructor(transport: string, transportSettings: any) {
    if(transport === 'mailgun'){
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
      this._transport = new MailgunProvider(mailgunSettings);
    }
    else if (transport === 'smtp') {
      this._transportName = 'smtp';

      const { smtp } = transportSettings;

      this._transport = new SmtpProvider({
        ...transportSettings,
        secure: false,
        ...smtp,
        tls: {
          rejectUnauthorized: false,
        },
      });

      
    } else if (transport === 'mandrill') {
      this._transportName = 'mandrill';
      const  mandrillSettings: MandrillConfig = {
        auth: {
          apiKey: transportSettings.mandrill.apiKey
        }
        
      };
     
      this._transport = new MandrillProvider(mandrillSettings);
    }
    else if(transport === 'sendgrid'){

      this._transportName = 'sendgrid';

      const sgSettings: SendGridConfig = {
            apiKey : transportSettings.apiKey,
  
      };
      this._transport = new SendgridProvider(sgSettings);
    } 
    else {
      this._transportName = undefined;
      this._transport = undefined;
      throw new Error('You need to specify a correct transport');
    }
  }

  sendEmailDirect(mailOptions: Mail.Options): Promise<SentMessageInfo> | undefined {

      const transport = this._transport;
      if (!transport) {
        throw new Error('Email  transport not initialized!');
      }
      return transport.sendEmailDirect(mailOptions);
    
  }

  emailBuilder(): EmailBuilderClass<Mail.Options> | MandrillBuilder | SendgridMailBuilder {
    if (!this._transport) {
      throw new Error('Email  transport not initialized!');
    }
    if (this._transportName === 'mailgun') {

      return new MailgunMailBuilder();

    } 
    if ( this._transportName === 'mandrill') {

      return new MandrillBuilder();
      
    }
    else if ( this._transportName === 'sendgrid'){
      return new SendgridMailBuilder();
    }
    else{
      return  new NodemailerBuilder();
    }
  }

  sendEmail(email: EmailBuilderClass<Mail.Options> | EmailBuilderClass<MandrillEmailOptions>): Promise<SentMessageInfo> | undefined  {
    if (!this._transport) {
      throw new Error('Email  transport not initialized!');
    }
    return this._transport.sendEmail(email.getMailObject());
  }
}




