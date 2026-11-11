import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../../errors.js';
import { TemplateOptions } from '../interfaces/index.js';
import Mail from 'nodemailer/lib/mailer/index.js';
import { EmailBuilderClass } from '../models/index.js';

export class MailersendBuilder extends EmailBuilderClass<Mail.Options> {
  constructor() {
    super();
  }

  setTemplate(template: TemplateOptions): EmailBuilderClass<Mail.Options> {
    throw new ModuleError(errors.EMAIL_OPERATION_UNSUPPORTED);
  }
}
