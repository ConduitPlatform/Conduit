import { initialize as initializeMailgun } from './transports/mailgun/mailgun';
import Mail from 'nodemailer/lib/mailer';
import { MailgunMailBuilder } from './transports/mailgun/mailgunMailBuilder';
import { NodemailerBuilder } from './transports/nodemailer/nodemailerBuilder';
import { EmailBuilder } from './interfaces/EmailBuilder';
import { createTransport, SentMessageInfo } from 'nodemailer';
import { MailgunConfig } from './transports/mailgun/mailgun.config';
import { EmailOptions } from './interfaces/EmailOptions';
import { isNil, template, times } from 'lodash';
import { MandrillConfig } from './transports/mandrill/mandrill.config';
import { Mandrill } from 'mandrill-api';
import { MandrillBuilder } from './transports/mandrill/mandrillBuilder';
import { EmailBuilderClass } from './models/EmailBuilderClass';
import { MandrillEmailOptions } from './interfaces/MandrillEmailOptions';

var mandrillTransport = require('nodemailer-mandrill-transport');
export class EmailProvider {
  _transport?: Mail;
  _mandrillTransport?: Mandrill;
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
    } else if (transport === 'mandrill') {
      this._transportName = 'mandrill';

      const  mandrillSettings: MandrillConfig = {

        auth: {
          apiKey: transportSettings.mandrill.apiKey
        }

      }
  
      this._transport = createTransport(mandrillTransport(mandrillSettings));

      this._mandrillTransport = new Mandrill(transportSettings.mandrill.apiKey);

    } else {
      this._transportName = undefined;
      this._transport = undefined;
      this._mandrillTransport = undefined;
      throw new Error('You need to specify a correct transport');
    }
  }

  sendEmailDirect(mailOptions: Mail.Options): Promise<SentMessageInfo> {

      const transport = this._transport as Mail;
      if (!transport) {
        throw new Error('Email  transport not initialized!');
      }
      return transport.sendMail(mailOptions);
    
  }

  emailBuilder(): EmailBuilder | MandrillBuilder {
    if (!this._transport) {
      throw new Error('Email  transport not initialized!');
    }
    if (this._transportName === 'mailgun') {
      return new MailgunMailBuilder();
    } else if ( this._transportName === 'mandrill') {
      console.log('edw2');
      return new MandrillBuilder();
    }
    else{
       return new NodemailerBuilder();
    }
  }

  sendEmail(email: EmailBuilder | EmailBuilderClass<MandrillEmailOptions>): Promise<SentMessageInfo> {
    if (!this._transport) {
      throw new Error('Email  transport not initialized!');
    }
    return (this._transport as Mail).sendMail(email.getMailObject());
  }

  getMandrillTemplateInfo(templateName: string ){
    this._mandrillTransport?.templates.info(templateName, res => {
      console.log(res);
    },
    err => {
      console.log(err);
    });
  }
  
  listMandrillTemplates(apiKey:any){

    this._mandrillTransport?.templates.list(apiKey, res =>{
      console.log(res);
    },
    err => {
      console.log(err);
    });
  }
  
}
import './test';  




