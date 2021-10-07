import { EmailBuilderClass } from '../../models/EmailBuilderClass';
import { MailgunEmailOptions } from '../../interfaces/mailgun/MailgunEmailOptions';
import { TemplateOptions } from '../../interfaces/TemplateOptions';

export class MailgunMailBuilder extends EmailBuilderClass<MailgunEmailOptions>{
  
  constructor(){
    super();
    
  }
  
  setTemplate(template : TemplateOptions): MailgunMailBuilder {
    if( !this._mailOptions.hasOwnProperty('name')){
        this._mailOptions.template = '' as any;
    }
    this._mailOptions.template = template.id,
    template.variables.forEach( element => {
      this._mailOptions['v:'+element.name] = element.content;
    })
    return this;
  }

  getMailObject(): MailgunEmailOptions{
    let options: MailgunEmailOptions = super.getMailObject();
    return options;
  }
}
