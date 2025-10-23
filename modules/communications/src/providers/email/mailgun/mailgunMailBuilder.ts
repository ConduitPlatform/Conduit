import { EmailBuilderClass } from '../models/index.js';
import { MailgunEmailOptions, TemplateOptions } from '../interfaces/index.js';

export class MailgunMailBuilder extends EmailBuilderClass<MailgunEmailOptions> {
  constructor() {
    super();
  }

  setTemplate(template: TemplateOptions): MailgunMailBuilder {
    if (!this._mailOptions.hasOwnProperty('name')) {
      this._mailOptions.template = '' as any;
    }
    this._mailOptions.template = template.id;
    Object.keys(template.variables).forEach(element => {
      this._mailOptions['v:' + element] = template.variables[element];
    });
    return this;
  }

  getMailObject(): MailgunEmailOptions {
    return super.getMailObject();
  }
}
