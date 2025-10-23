import { SendgridMailOptions } from '../../interfaces/sendgrid/SendgridEmailOptions.js';
import { TemplateOptions } from '../../interfaces/TemplateOptions.js';
import { EmailBuilderClass } from '../../models/EmailBuilderClass.js';
import { Var } from '../../interfaces/Var.js';

export class SendgridMailBuilder extends EmailBuilderClass<SendgridMailOptions> {
  constructor() {
    super();
  }

  setTemplate(template: TemplateOptions): SendgridMailBuilder {
    if (!this._mailOptions.hasOwnProperty('dynamicTemplateData')) {
      this._mailOptions.dynamicTemplateData = {} as any;
    }
    template.variables.forEach((element: Var) => {
      this._mailOptions.dynamicTemplateData[element.name] = element.content;
    });
    this._mailOptions.templateId = template.id;

    return this;
  }
}
