import Mail from 'nodemailer/lib/mailer';
import { TemplateOptions } from '../../interfaces/TemplateOptions';
import { EmailBuilderClass } from '../../models/EmailBuilderClass';

export class NodemailerBuilder extends EmailBuilderClass<Mail.Options> {
  setTemplate(template: TemplateOptions): EmailBuilderClass<Mail.Options> {
    throw new Error('Method not implemented.');
  }

  constructor() {
    super();
  }
}
