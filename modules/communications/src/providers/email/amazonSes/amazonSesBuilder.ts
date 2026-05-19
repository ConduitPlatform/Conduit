import { EmailBuilderClass } from '../models/index.js';
import { AmazonSesEmailOptions, TemplateOptions } from '../interfaces/index.js';

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
