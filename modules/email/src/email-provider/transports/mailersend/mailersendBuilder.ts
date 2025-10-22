import { EmailBuilderClass } from '../../models/EmailBuilderClass.js';
import { TemplateOptions } from '../../interfaces/TemplateOptions.js';
import Mail from 'nodemailer/lib/mailer/index.js';

export class MailersendBuilder extends EmailBuilderClass<Mail.Options> {
  constructor() {
    super();
  }

  setTemplate(template: TemplateOptions): EmailBuilderClass<Mail.Options> {
    throw new Error('Method not implemented.');
  }
}
