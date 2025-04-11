import { EmailBuilderClass } from '../../models/EmailBuilderClass.js';
import { TemplateOptions } from '../../interfaces/TemplateOptions.js';
import { AmazonSesEmailOptions } from '../../interfaces/amazonSes/AmazonSesEmailOptions.js';

export class AmazonSesBuilder extends EmailBuilderClass<AmazonSesEmailOptions> {
  constructor() {
    super();
  }

  setTemplate(template: TemplateOptions): AmazonSesBuilder {
    this._mailOptions.template = template.id;
    this._mailOptions.templateData = JSON.stringify(template.variables);
    return this;
  }
}
