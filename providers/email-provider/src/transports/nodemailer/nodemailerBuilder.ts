import Mail from 'nodemailer/lib/mailer';
import { EmailBuilder } from '../../interfaces/EmailBuilder';
import { TemplateOptions } from '../../interfaces/TemplateOptions';
import { EmailBuilderClass } from '../../models/EmailBuilderClass';
import { checkIfHTML } from '../../utils';

export class NodemailerBuilder extends EmailBuilderClass<Mail.Options> {
  setTemplate(template: TemplateOptions): EmailBuilderClass<Mail.Options> {
    throw new Error('Method not implemented.');
  }
  constructor(){
    super();
  }
  // private 'h:Reply-To'?: string;
 
}
