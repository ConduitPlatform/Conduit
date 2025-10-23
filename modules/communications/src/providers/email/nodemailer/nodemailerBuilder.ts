import Mail from 'nodemailer/lib/mailer/index.js';
import { TemplateOptions } from '../../interfaces/TemplateOptions.js';
import { EmailBuilderClass } from '../../models/EmailBuilderClass.js';

export class NodemailerBuilder extends EmailBuilderClass<Mail.Options> {
  constructor() {
    super();
  }

  setTemplate(template: TemplateOptions): EmailBuilderClass<Mail.Options> {
    throw new Error('Method not implemented.');
  }
}
