import { EmailBuilderClass } from '../../models/EmailBuilderClass.js';
import { MandrillEmailOptions } from '../../interfaces/mandrill/MandrillEmailOptions.js';
import { TemplateOptions } from '../../interfaces/TemplateOptions.js';
import { Var } from '../../interfaces/Var.js';

export class MandrillBuilder extends EmailBuilderClass<MandrillEmailOptions> {
  constructor() {
    super();
    this._mailOptions.mandrillOptions = {} as any;
  }

  setTemplate(template: TemplateOptions): MandrillBuilder {
    if (!this._mailOptions.hasOwnProperty('mandrillOptions')) {
      this._mailOptions.mandrillOptions = {} as any;
    }
    this._mailOptions.mandrillOptions.template_content = [];
    this._mailOptions.mandrillOptions.template_name = template.id;

    if (!this._mailOptions.mandrillOptions.hasOwnProperty('message')) {
      this._mailOptions.mandrillOptions.message = {} as any;
    }
    this._mailOptions.mandrillOptions.message.merge = true;
    this._mailOptions.mandrillOptions.message.merge_language = 'handlebars';
    const variables: Var[] = [];
    Object.keys(template.variables).forEach(key => {
      variables.push({
        name: key,
        content: template.variables[key],
      });
    });
    this._mailOptions.mandrillOptions.message.global_merge_vars = variables;

    return this;
  }
}
