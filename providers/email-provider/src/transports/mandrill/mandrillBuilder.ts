import { EmailBuilderClass } from '../../models/EmailBuilderClass';
import { MandrillEmailOptions,Var } from '../../interfaces/MandrillEmailOptions';

export class MandrillBuilder extends EmailBuilderClass<MandrillEmailOptions> {

  constructor(){

    super();
    this._mailOptions.mandrillOptions = {} as any;

  }
  setTemplateName(name: string): MandrillBuilder {

    this._mailOptions.mandrillOptions.template_name = name;
    return this;

  }
  setTemplateContent(): MandrillBuilder{ 

    this._mailOptions.mandrillOptions.template_content = [];
    return this;

  }

  setTemplateMessage(globalVariables : Var[]) : MandrillBuilder {
    if( !this._mailOptions.mandrillOptions.hasOwnProperty('message')){
      this._mailOptions.mandrillOptions.message = {} as any;
    }
    this._mailOptions.mandrillOptions.message.merge = true;
    this._mailOptions.mandrillOptions.message.merge_language = "handlebars";
    this._mailOptions.mandrillOptions.message.global_merge_vars = globalVariables;
    
    console.log(this._mailOptions);
    return this;
  }

  
}